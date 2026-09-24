import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase, runMigrations, SqliteUserRepository } from "../src/index.js";

test("sqlite users: auth_id migration and repository mappings work", async () => {
  const db = openDatabase(":memory:");
  runMigrations(db);
  const columns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  assert.ok(columns.some((column) => column.name === "auth_id"));

  const repository = new SqliteUserRepository(db);
  const user = await repository.create({
    role: "admin",
    fullName: "Auth Admin",
    email: " Admin@Example.com ",
    clientId: null,
  });

  assert.equal(await repository.findByAuthId("supabase-user"), null);
  assert.equal((await repository.findByNormalizedEmail("admin@example.com"))?.id, user.id);
  assert.equal(await repository.setAuthId(user.id, "supabase-user"), true);
  assert.equal((await repository.findByAuthId("supabase-user"))?.id, user.id);
  assert.equal((await repository.findById(user.id))?.authId, "supabase-user");

  db.close();
});

test("sqlite users: auth_id queries never regress to no-such-column", async () => {
  const db = openDatabase(":memory:");
  runMigrations(db);
  const repository = new SqliteUserRepository(db);
  await assert.doesNotReject(() => repository.findByAuthId("missing"));
  db.close();
});
