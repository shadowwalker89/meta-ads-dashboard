import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  openDatabase,
  runMigrations,
  SqliteAdminAssignmentRepository,
  SqliteClientRepository,
  SqlitePackageRepository,
  SqliteUserRepository,
} from "@repo/database";
import type { Package, User } from "@repo/shared";
import {
  AccessError,
  accessibleClientIds,
  requireClientAccess,
  requireRole,
  requireUser,
} from "@/lib/access";

type Db = ReturnType<typeof openDatabase>;

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

async function createUser(
  db: Db,
  overrides: Partial<Omit<User, "id" | "createdAt">>
): Promise<User> {
  return new SqliteUserRepository(db).create({
    role: "client",
    fullName: "User",
    email: "user@example.com",
    clientId: null,
    ...overrides,
  });
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

function isForbidden(error: unknown): boolean {
  return error instanceof AccessError && error.kind === "forbidden";
}

test("access: client can access their own client", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const c1 = await createClient(db, pkg.id, "Client One");
  const clientUser = makeUser({ id: "cu", clientId: c1.id });

  await requireClientAccess(clientUser, c1.id, db);
  assert.deepEqual(await accessibleClientIds(clientUser, db), [c1.id]);

  db.close();
});

test("access: client cannot access another client", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const c1 = await createClient(db, pkg.id, "Client One");
  const c2 = await createClient(db, pkg.id, "Client Two");
  const clientUser = makeUser({ id: "cu", clientId: c1.id });

  await assert.rejects(
    () => requireClientAccess(clientUser, c2.id, db),
    isForbidden
  );

  db.close();
});

test("access: admin can access assigned client", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const c1 = await createClient(db, pkg.id, "Client One");
  const admin = await createUser(db, {
    role: "admin",
    email: "admin@example.com",
  });
  await new SqliteAdminAssignmentRepository(db).assign(admin.id, c1.id);
  const adminUser = makeUser({ id: admin.id, role: "admin" });

  await requireClientAccess(adminUser, c1.id, db);
  assert.deepEqual(await accessibleClientIds(adminUser, db), [c1.id]);

  db.close();
});

test("access: admin cannot access unassigned client", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const c1 = await createClient(db, pkg.id, "Client One");
  const c2 = await createClient(db, pkg.id, "Client Two");
  const admin = await createUser(db, {
    role: "admin",
    email: "admin@example.com",
  });
  await new SqliteAdminAssignmentRepository(db).assign(admin.id, c1.id);
  const adminUser = makeUser({ id: admin.id, role: "admin" });

  await assert.rejects(
    () => requireClientAccess(adminUser, c2.id, db),
    isForbidden
  );

  db.close();
});

test("access: super_admin can access any client", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const c1 = await createClient(db, pkg.id, "Client One");
  const c2 = await createClient(db, pkg.id, "Client Two");
  const superUser = makeUser({ id: "sa", role: "super_admin" });

  await requireClientAccess(superUser, c1.id, db);
  await requireClientAccess(superUser, c2.id, db);
  assert.deepEqual(
    (await accessibleClientIds(superUser, db)).sort(),
    [c1.id, c2.id].sort()
  );

  db.close();
});

test("access: unauthenticated access is rejected per the login convention", async () => {
  await assert.rejects(
    () => requireUser(async () => null),
    (error) =>
      error instanceof AccessError &&
      error.kind === "unauthenticated" &&
      /ابتدا وارد شوید/.test(error.message)
  );

  const user = makeUser();
  assert.equal(await requireUser(async () => user), user);
});

test("access: arbitrary clientId cannot bypass authorization", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const c1 = await createClient(db, pkg.id, "Client One");
  const c2 = await createClient(db, pkg.id, "Client Two");
  const admin = await createUser(db, {
    role: "admin",
    email: "admin@example.com",
  });
  await new SqliteAdminAssignmentRepository(db).assign(admin.id, c1.id);
  const adminUser = makeUser({ id: admin.id, role: "admin" });
  const clientUser = makeUser({ id: "cu", clientId: c1.id });

  // A nonexistent id is never accessible.
  await assert.rejects(
    () => requireClientAccess(clientUser, "does-not-exist", db),
    isForbidden
  );
  await assert.rejects(
    () => requireClientAccess(adminUser, "does-not-exist", db),
    isForbidden
  );
  // A real client that is NOT assigned to the admin stays unreachable.
  await assert.rejects(
    () => requireClientAccess(adminUser, c2.id, db),
    isForbidden
  );

  db.close();
});

test("access: requireRole enforces the requested roles", () => {
  const admin = makeUser({ role: "admin" });
  const superUser = makeUser({ role: "super_admin" });

  assert.throws(() => requireRole(admin, "super_admin"), isForbidden);
  assert.throws(() => requireRole(makeUser({ role: "client" }), "admin", "super_admin"), isForbidden);
  assert.doesNotThrow(() => requireRole(superUser, "super_admin"));
  assert.doesNotThrow(() => requireRole(admin, "admin", "super_admin"));
});

test("access: client with no clientId resolves no clients", async () => {
  const db = createTestDb();
  const pkg = await createPackage(db);
  const c1 = await createClient(db, pkg.id, "Client One");
  const orphanClientUser = makeUser({ id: "cu", clientId: null });

  assert.deepEqual(await accessibleClientIds(orphanClientUser, db), []);
  await assert.rejects(
    () => requireClientAccess(orphanClientUser, c1.id, db),
    isForbidden
  );

  db.close();
});