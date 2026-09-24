"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@repo/shared";
import { Button } from "@/components/ui/button";
import { useDashboardLang } from "@/components/layout/language-provider";
import {
  createApplicationUser,
  setApplicationUserPassword,
  setApplicationUserStatus,
  updateApplicationUser,
} from "@/app/(dashboard)/admin/users/actions";
import type { UserAdminData, UserAdminEntry } from "@/lib/user-admin";

const inputClass = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
type SaveState = { status: "idle" | "saving" | "success" | "error"; message?: string; auditRecorded?: boolean };
type PasswordSaveState = { status: "idle" | "saving" | "success" | "error"; message?: string; auditRecorded?: boolean };

export interface UserFormState {
  name: string;
  email: string;
  password: string;
  role: "admin" | "client";
  clientId: string;
  newPassword: string;
}

export function createEmptyUserFormState(canCreateAdmin: boolean): UserFormState {
  return {
    name: "",
    email: "",
    password: "",
    role: canCreateAdmin ? "admin" : "client",
    clientId: "",
    newPassword: "",
  };
}

function applyUserToFormStateBase(state: UserFormState, user: UserAdminEntry): UserFormState {
  return {
    ...state,
    name: user.fullName,
    email: user.email,
    role: editingRoleFor(user),
    clientId: user.clientId ?? "",
    password: "",
    newPassword: "",
  };
}

export const applyUserToFormState = applyUserToFormStateBase;

function roleLabel(role: User["role"], t: ReturnType<typeof useDashboardLang>["strings"]): string {
  return role === "admin" ? t.adminUsersRoleAdmin : role === "client" ? t.adminUsersRoleClient : role;
}

export function UserManagement({ data }: { data: UserAdminData }) {
  const router = useRouter();
  const { strings: t, lang } = useDashboardLang();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserAdminEntry | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "client">(data.canCreateAdmin ? "admin" : "client");
  const [clientId, setClientId] = useState("");
  const [state, setState] = useState<SaveState>({ status: "idle" });

  const [newPassword, setNewPassword] = useState("");
  const [passwordState, setPasswordState] = useState<PasswordSaveState>({ status: "idle" });
  const canChangePassword = editing !== null && editing.role !== "super_admin";
  const canSubmitPassword = canChangePassword && newPassword.length >= 8 && passwordState.status !== "saving" && state.status !== "saving";

  const canSubmit = name.trim() && email.trim() && password && (role === "admin" || clientId) && state.status !== "saving";

  function applyFormState(next: UserFormState) {
    setName(next.name);
    setEmail(next.email);
    setPassword(next.password);
    setRole(next.role);
    setClientId(next.clientId);
    setNewPassword(next.newPassword);
  }

  function openCreate() {
    setEditing(null);
    applyFormState(createEmptyUserFormState(data.canCreateAdmin));
    setState({ status: "idle" });
    setPasswordState({ status: "idle" });
    setOpen(true);
  }

  function closeForm() {
    setOpen(false);
    setEditing(null);
    applyFormState(createEmptyUserFormState(data.canCreateAdmin));
    setState({ status: "idle" });
    setPasswordState({ status: "idle" });
  }

  function startEdit(user: UserAdminEntry) {
    setEditing(user);
    setOpen(false);
    applyFormState(applyUserToFormState(createEmptyUserFormState(data.canCreateAdmin), user));
    setState({ status: "idle" });
    setPasswordState({ status: "idle" });
  }

  async function submitCreate() {
    if (!canSubmit) return;
    setState({ status: "saving" });
    const result = await createApplicationUser({ fullName: name.trim(), email: email.trim(), password, role, clientId: role === "client" ? clientId : null });
    if (!result.ok) return setState({ status: "error", message: result.error });
    setState({ status: "success", auditRecorded: result.auditRecorded });
    applyFormState(createEmptyUserFormState(data.canCreateAdmin));
    setPasswordState({ status: "idle" });
    router.refresh();
  }

  async function submitEdit() {
    if (!editing || !name.trim() || state.status === "saving") return;
    setState({ status: "saving" });
    const result = await updateApplicationUser({ userId: editing.id, fullName: name.trim(), role, clientId: role === "client" ? clientId : null });
    if (!result.ok) return setState({ status: "error", message: result.error });
    setState({ status: "success", auditRecorded: result.auditRecorded });
    router.refresh();
  }

  async function submitPassword() {
    if (!editing || !canSubmitPassword) return;
    setPasswordState({ status: "saving" });
    const result = await setApplicationUserPassword({ userId: editing.id, password: newPassword });
    if (!result.ok) {
      setNewPassword("");
      return setPasswordState({ status: "error", message: result.error });
    }
    setPasswordState({ status: "success", auditRecorded: result.auditRecorded });
    setNewPassword("");
    router.refresh();
  }

  async function toggleStatus(user: UserAdminEntry) {
    setState({ status: "saving" });
    const result = await setApplicationUserStatus({ userId: user.id, isActive: !user.isActive });
    if (!result.ok) return setState({ status: "error", message: result.error });
    setState({ status: "success", auditRecorded: result.auditRecorded });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end"><Button onClick={openCreate}>{t.adminUsersCreate}</Button></div>
      {(open || editing) ? (
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2"><h2 className="text-base font-semibold">{editing ? t.adminUsersEditTitle : t.adminUsersCreateTitle}</h2><Button variant="ghost" size="sm" onClick={closeForm}>{t.adminUsersCancel}</Button></div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium"><span>{editing ? t.adminUsersEditName : t.adminUsersCreateName}</span><input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></label>
            {!editing ? <label className="flex flex-col gap-2 text-sm font-medium"><span>{t.adminUsersCreateEmail}</span><input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} /></label> : null}
            {!editing ? <label className="flex flex-col gap-2 text-sm font-medium"><span>{t.adminUsersCreatePassword}</span><input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} /></label> : null}
            <label className="flex flex-col gap-2 text-sm font-medium"><span>{editing ? t.adminUsersEditRole : t.adminUsersCreateRole}</span><select value={role} onChange={(e) => setRole(e.target.value as "admin" | "client")} className={inputClass} disabled={editing?.role === "admin" && data.actorId === editing.id}><option value="client">{t.adminUsersRoleClient}</option>{data.canCreateAdmin ? <option value="admin">{t.adminUsersRoleAdmin}</option> : null}</select></label>
            {role === "client" ? <label className="flex flex-col gap-2 text-sm font-medium"><span>{editing ? t.adminUsersEditClient : t.adminUsersCreateClient}</span><select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass}><option value="">{t.adminUsersCreateClient}</option>{data.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label> : null}
          </div>
          <div className="flex flex-wrap items-center gap-3"><Button onClick={editing ? submitEdit : submitCreate} disabled={editing ? !name.trim() || state.status === "saving" : !canSubmit}>{state.status === "saving" ? (editing ? t.adminUsersEditSaving : t.adminUsersCreateSaving) : (editing ? t.adminUsersEditSubmit : t.adminUsersCreateSubmit)}</Button>{state.status === "success" ? <p className="text-sm text-emerald-600">{state.auditRecorded ? (editing ? t.adminUsersEdited : t.adminUsersCreated) : (editing ? t.adminUsersEditedAuditWarning : t.adminUsersCreatedAuditWarning)}</p> : null}{state.status === "error" ? <p className="text-sm text-destructive">{state.message}</p> : null}</div>
          {editing && canChangePassword ? (
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">{t.adminUsersSetPasswordTitle}</h3>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium"><span>{t.adminUsersSetPasswordLabel}</span><input type="password" autoComplete="new-password" dir="ltr" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} placeholder={t.adminUsersSetPasswordPlaceholder} /></label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={submitPassword} disabled={!canSubmitPassword}>{passwordState.status === "saving" ? t.adminUsersSetPasswordSaving : t.adminUsersSetPasswordSubmit}</Button>
                {passwordState.status === "success" ? <p className="text-sm text-emerald-600">{passwordState.auditRecorded ? t.adminUsersPasswordUpdated : t.adminUsersPasswordUpdatedAuditWarning}</p> : null}
                {passwordState.status === "error" ? <p className="text-sm text-destructive">{passwordState.message}</p> : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
      {data.users.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{t.adminUsersEmpty}</div> : <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-sm"><thead className="border-b border-border text-right text-muted-foreground"><tr><th className="p-3">{t.adminUsersName}</th><th className="p-3">{t.adminUsersEmail}</th><th className="p-3">{t.adminUsersRole}</th><th className="p-3">{t.adminUsersClient}</th><th className="p-3">{t.adminUsersStatus}</th><th className="p-3">{t.adminUsersCreatedAt}</th><th className="p-3" /></tr></thead><tbody>{data.users.map((user) => <tr key={user.id} className="border-b border-border last:border-0"><td className="p-3">{user.fullName}</td><td className="p-3" dir="ltr">{user.email}</td><td className="p-3">{roleLabel(user.role, t)}</td><td className="p-3">{user.clientName ?? t.adminUsersNoClient}</td><td className="p-3">{user.isActive ? t.adminUsersActive : t.adminUsersInactive}</td><td className="p-3">{new Intl.DateTimeFormat(lang === "fa" ? "fa-IR" : "en-US", { dateStyle: "medium" }).format(user.createdAt)}</td><td className="p-3"><div className="flex gap-2"><Button size="sm" variant="outline" disabled={user.role === "super_admin"} onClick={() => startEdit(user)}>{t.adminUsersEdit}</Button><Button size="sm" variant="ghost" disabled={user.role === "super_admin" || user.id === data.actorId || state.status === "saving"} onClick={() => toggleStatus(user)}>{user.isActive ? t.adminUsersDeactivate : t.adminUsersActivate}</Button></div></td></tr>)}</tbody></table></div>}
    </div>
  );
}

function editingRoleFor(user: UserAdminEntry): "admin" | "client" {
  return user.role === "admin" ? "admin" : "client";
}
