import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  openDatabase,
  runMigrations,
  SqliteAdminAssignmentRepository,
  SqliteClientRepository,
  SqlitePackageRepository,
  SqliteUserRepository,
} from "@repo/database";
import type { Package, User } from "@repo/shared";
import { resolveCurrentUser } from "@/lib/auth";
import { resolveAuthProviderName } from "@/lib/auth/config";
import { MockAuthProvider, MockAuthUserMapper } from "@/lib/auth/mock";
import {
  SupabaseAuthProvider,
  SupabaseAuthUserMapper,
} from "@/lib/auth/supabase";
import {
  parseMockSession,
  serializeMockSession,
  type MockSessionStore,
} from "@/lib/mock-auth";
import {
  accessibleClientIds,
  requireClientAccess,
} from "@/lib/access";

type Db = ReturnType<typeof openDatabase>;

const APP_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

class InMemoryStore implements MockSessionStore {
  private value: { userId: string } | null = null;
  async get() {
    return this.value;
  }
  async set(payload: { userId: string }) {
    this.value = payload;
  }
  async delete() {
    this.value = null;
  }
}

class FakeUsers {
  constructor(private readonly users: User[]) {}
  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u-1",
    role: "client",
    fullName: "User",
    email: "user@example.com",
    clientId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createTestDb(): Db {
  const db = openDatabase(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

async function createPackage(db: Db, code = "gold"): Promise<Package> {
  return new SqlitePackageRepository(db).create({
    name: "Gold",
    description: "Gold plan",
    code,
    collectionFrequency: 1,
    maxAdAccounts: null,
    maxCampaigns: null,
    retentionDays: null,
    defaultVisibleKpis: [],
    features: { charts: false, dataExport: false, advancedReporting: false },
    pricingDefaults: {},
    metricThresholds: {},
  });
}

async function createClient(
  db: Db,
  packageId: string,
  name: string
): Promise<{ id: string }> {
  return new SqliteClientRepository(db).create({
    name,
    businessType: "General",
    contactEmail: `${name}@example.com`,
    packageId,
    isActive: true,
  });
}

function isForbidden(error: unknown): boolean {
  return (
    error instanceof Error &&
    "kind" in error &&
    (error as { kind?: string }).kind === "forbidden"
  );
}

test("auth-boundary: authenticated identity maps to the correct application User", async () => {
  const users = new FakeUsers([
    makeUser({
      id: "su-1",
      role: "super_admin",
      fullName: "Super Admin",
      email: "superadmin@example.com",
    }),
    makeUser({
      id: "cu-1",
      role: "client",
      fullName: "Client 1 User",
      email: "client1user@example.com",
      clientId: "c-1",
    }),
  ]);
  const store = new InMemoryStore();
  const provider = new MockAuthProvider({ store, users });
  const mapper = new MockAuthUserMapper(users);

  const session = await provider.signIn({ email: "superadmin@example.com" });
  assert.equal(session.identity.id, "superadmin@example.com");
  assert.equal(session.identity.provider, "mock");

  const user = await resolveCurrentUser({ provider, mapper });
  assert.ok(user);
  assert.equal(user.id, "su-1");
  assert.equal(user.role, "super_admin");
  assert.equal(user.fullName, "Super Admin");
});

test("auth-boundary: unknown identity is rejected at sign-in", async () => {
  const users = new FakeUsers([makeUser({ email: "known@example.com" })]);
  const provider = new MockAuthProvider({ store: new InMemoryStore(), users });

  await assert.rejects(
    () => provider.signIn({ email: "ghost@example.com" }),
    /Unknown user/
  );
  // A failed sign-in must not leave a session behind.
  assert.equal(await provider.getSession(), null);
});

test("auth-boundary: role comes from the application User, not the cookie", async () => {
  const admin = makeUser({
    id: "ad-1",
    role: "admin",
    email: "admin1@example.com",
  });
  const users = new FakeUsers([admin]);
  const store = new InMemoryStore();
  const provider = new MockAuthProvider({ store, users });
  const mapper = new MockAuthUserMapper(users);

  await provider.signIn({ email: "admin1@example.com" });

  // The cookie payload carries ONLY the identity handle — no role,
  // no clientId, nothing forgeable into authorization.
  const payload = await store.get();
  assert.deepEqual(payload, { userId: "admin1@example.com" });
  const serialized = serializeMockSession({ userId: "admin1@example.com" });
  assert.deepEqual(JSON.parse(serialized), { userId: "admin1@example.com" });
  assert.deepEqual(parseMockSession(serialized), {
    userId: "admin1@example.com",
  });
  // A tampered cookie smuggling extra claims is rejected as signed out.
  assert.equal(
    parseMockSession(
      JSON.stringify({ userId: "admin1@example.com", role: "super_admin" })
    ),
    null
  );
  assert.equal(parseMockSession("{not json"), null);

  const user = await resolveCurrentUser({ provider, mapper });
  assert.ok(user);
  assert.equal(user.role, "admin");
  assert.equal(user.id, "ad-1");
});

test("auth-boundary: client can access only their own client via access.ts", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const c1 = await createClient(db, pkg.id, "Client One");
  const c2 = await createClient(db, pkg.id, "Client Two");
  await new SqliteUserRepository(db).create({
    role: "client",
    fullName: "Client 1 User",
    email: "client1user@example.com",
    clientId: c1.id,
  });
  const users = new SqliteUserRepository(db);
  const provider = new MockAuthProvider({
    store: new InMemoryStore(),
    users,
  });
  const mapper = new MockAuthUserMapper(users);
  await provider.signIn({ email: "client1user@example.com" });

  const user = await resolveCurrentUser({ provider, mapper });
  assert.ok(user);
  assert.equal(user.role, "client");

  await requireClientAccess(user, c1.id, db);
  assert.deepEqual(await accessibleClientIds(user, db), [c1.id]);
  await assert.rejects(
    () => requireClientAccess(user, c2.id, db),
    isForbidden
  );

  db.close();
});

test("auth-boundary: admin can access only assigned clients", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const c1 = await createClient(db, pkg.id, "Client One");
  const c2 = await createClient(db, pkg.id, "Client Two");
  const adminRow = await new SqliteUserRepository(db).create({
    role: "admin",
    fullName: "Admin 1",
    email: "admin1@example.com",
    clientId: null,
  });
  await new SqliteAdminAssignmentRepository(db).assign(adminRow.id, c1.id);
  const users = new SqliteUserRepository(db);
  const provider = new MockAuthProvider({
    store: new InMemoryStore(),
    users,
  });
  const mapper = new MockAuthUserMapper(users);
  await provider.signIn({ email: "admin1@example.com" });

  const user = await resolveCurrentUser({ provider, mapper });
  assert.ok(user);
  assert.equal(user.role, "admin");

  await requireClientAccess(user, c1.id, db);
  assert.deepEqual(await accessibleClientIds(user, db), [c1.id]);
  await assert.rejects(
    () => requireClientAccess(user, c2.id, db),
    isForbidden
  );

  db.close();
});

test("auth-boundary: super_admin is unrestricted via access.ts", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const c1 = await createClient(db, pkg.id, "Client One");
  const c2 = await createClient(db, pkg.id, "Client Two");
  await new SqliteUserRepository(db).create({
    role: "super_admin",
    fullName: "Super Admin",
    email: "superadmin@example.com",
    clientId: null,
  });
  const users = new SqliteUserRepository(db);
  const provider = new MockAuthProvider({
    store: new InMemoryStore(),
    users,
  });
  const mapper = new MockAuthUserMapper(users);
  await provider.signIn({ email: "superadmin@example.com" });

  const user = await resolveCurrentUser({ provider, mapper });
  assert.ok(user);
  assert.equal(user.role, "super_admin");

  await requireClientAccess(user, c1.id, db);
  await requireClientAccess(user, c2.id, db);
  const accessible = (await accessibleClientIds(user, db)).sort();
  assert.deepEqual(accessible, [c1.id, c2.id].sort());

  db.close();
});

test("auth-boundary: mock provider is the dev/test default", () => {
  assert.equal(resolveAuthProviderName({ NODE_ENV: "development" }), "mock");
  assert.equal(resolveAuthProviderName({ NODE_ENV: "test" }), "mock");
  assert.equal(resolveAuthProviderName({}), "mock");
  assert.equal(resolveAuthProviderName({ AUTH_PROVIDER: "mock" }), "mock");
  assert.throws(() => resolveAuthProviderName({ AUTH_PROVIDER: "bogus" }), /Unknown AUTH_PROVIDER/);
});

test("auth-boundary: production cannot silently fall back to mock", () => {
  // No AUTH_PROVIDER at all in production -> throw, never default to mock.
  assert.throws(() => resolveAuthProviderName({ NODE_ENV: "production" }));
  // Explicitly asking for mock in production -> throw.
  assert.throws(() =>
    resolveAuthProviderName({ NODE_ENV: "production", AUTH_PROVIDER: "mock" })
  );
  // Supabase is the only production-allowed provider.
  assert.equal(
    resolveAuthProviderName({
      NODE_ENV: "production",
      AUTH_PROVIDER: "supabase",
    }),
    "supabase"
  );
});

test("auth-boundary: supabase provider is a configured, fail-loud boundary", () => {
  // Unconfigured real auth refuses to construct (no silent fallback).
  assert.throws(
    () => new SupabaseAuthProvider({}),
    /SUPABASE_URL \/ SUPABASE_ANON_KEY/
  );
  const provider = new SupabaseAuthProvider({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "anon-key",
  });
  // Until the deployment phase, every real-auth method fails loudly.
  assert.rejects(() => provider.signIn({ email: "a@b.com" }), /not wired/);
  assert.rejects(() => provider.signOut(), /not wired/);
  assert.rejects(() => provider.getSession(), /not wired/);
  assert.rejects(() => new SupabaseAuthUserMapper().findByAuthId("id"), /not wired/);
});

test("auth-boundary: no auth session secret reaches client components", () => {
  const clientFiles = [
    "components/layout/sidebar.tsx",
    "components/layout/topbar.tsx",
    "components/layout/mobile-nav.tsx",
  ];
  for (const file of clientFiles) {
    const source = readFileSync(resolve(APP_DIR, file), "utf8");
    assert.ok(
      !/@\/lib\/(auth|mock-auth)/.test(source),
      `${file} must not import server-side auth code`
    );
    assert.ok(
      !/SUPABASE_ANON_KEY|SERVICE_ROLE|service-role|MOCK_SESSION_COOKIE/.test(
        source
      ),
      `${file} must not reference auth secrets or the session cookie`
    );
  }
});

test("auth-boundary: an orphaned identity is rejected, never authorized anonymously", async () => {
  const users = new FakeUsers([makeUser({ email: "known@example.com" })]);
  const store = new InMemoryStore();
  const provider = new MockAuthProvider({ store, users });
  const mapper = new MockAuthUserMapper(users);

  // Simulate a stale/foreign cookie whose identity has no User row.
  await store.set({ userId: "orphan@example.com" });

  await assert.rejects(
    () => resolveCurrentUser({ provider, mapper }),
    /no matching application User/
  );
});