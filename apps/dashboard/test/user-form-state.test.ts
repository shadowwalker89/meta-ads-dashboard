import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyUserToFormState,
  createEmptyUserFormState,
} from "@/components/admin/user-management";
import type { UserAdminEntry } from "@/lib/user-admin";

const CLIENT_ENTRY: UserAdminEntry = {
  id: "user-1",
  fullName: "Alice Example",
  email: "alice@example.com",
  role: "client",
  clientId: "client-1",
  clientName: "Client One",
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

const ADMIN_ENTRY: UserAdminEntry = {
  ...CLIENT_ENTRY,
  id: "user-2",
  fullName: "Bob Admin",
  email: "bob@example.com",
  role: "admin",
  clientId: null,
  clientName: null,
};

test("form: createEmptyUserFormState defaults all fields to empty/role default", () => {
  const state = createEmptyUserFormState(true);
  assert.equal(state.name, "");
  assert.equal(state.email, "");
  assert.equal(state.password, "");
  assert.equal(state.clientId, "");
  assert.equal(state.newPassword, "");
  assert.equal(state.role, "admin");
  const stateNoAdmin = createEmptyUserFormState(false);
  assert.equal(stateNoAdmin.role, "client");
});

test("form: Edit → Create resets every field to empty/default", () => {
  const afterEdit = applyUserToFormState(createEmptyUserFormState(true), CLIENT_ENTRY);
  assert.equal(afterEdit.name, CLIENT_ENTRY.fullName);
  assert.equal(afterEdit.email, CLIENT_ENTRY.email);
  const afterCreate = createEmptyUserFormState(false);
  assert.equal(afterCreate.name, "");
  assert.equal(afterCreate.email, "");
  assert.equal(afterCreate.password, "");
  assert.equal(afterCreate.newPassword, "");
  assert.equal(afterCreate.clientId, "");
  assert.equal(afterCreate.role, "client");
  assert.notEqual(afterEdit.name, afterCreate.name, "name must be reset");
  assert.notEqual(afterEdit.email, afterCreate.email, "email must be reset");
  assert.notEqual(afterEdit.clientId, afterCreate.clientId, "client must be reset");
});

test("form: password is never carried from Edit into Create", () => {
  const afterEdit = applyUserToFormState(createEmptyUserFormState(false), CLIENT_ENTRY);
  assert.equal(afterEdit.password, "");
  assert.equal(afterEdit.newPassword, "");
  const afterCreate = createEmptyUserFormState(false);
  assert.equal(afterCreate.password, "");
  assert.equal(afterCreate.newPassword, "");
  assert.equal(afterEdit.password, afterCreate.password);
  assert.equal(afterEdit.newPassword, afterCreate.newPassword);
});

test("form: Create → Edit only seeds the selected user's data; password fields stay empty", () => {
  const afterEdit = applyUserToFormState(createEmptyUserFormState(true), ADMIN_ENTRY);
  assert.equal(afterEdit.name, ADMIN_ENTRY.fullName);
  assert.equal(afterEdit.email, ADMIN_ENTRY.email);
  assert.equal(afterEdit.role, "admin");
  assert.equal(afterEdit.clientId, "");
  assert.equal(afterEdit.password, "", "create-mode password must not be carried into edit");
  assert.equal(afterEdit.newPassword, "", "edit-mode new password must start empty");
});
