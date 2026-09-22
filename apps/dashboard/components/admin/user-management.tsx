"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@repo/shared";
import { Button } from "@/components/ui/button";
import { useDashboardLang } from "@/components/layout/language-provider";
import { createApplicationUser } from "@/app/(dashboard)/admin/users/actions";
import type { UserAdminData } from "@/lib/user-admin";

const inputClass = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type SaveState = { status: "idle" | "saving" | "success" | "error"; message?: string; auditRecorded?: boolean };

function roleLabel(role: User["role"], t: ReturnType<typeof useDashboardLang>["strings"]): string {
  return role === "admin" ? t.adminUsersRoleAdmin : role === "client" ? t.adminUsersRoleClient : role;
}

export function UserManagement({ data }: { data: UserAdminData }) {
  const router = useRouter();
  const { strings: t, lang } = useDashboardLang();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "client">(data.canCreateAdmin ? "admin" : "client");
  const [clientId, setClientId] = useState("");
  const [state, setState] = useState<SaveState>({ status: "idle" });

  const canSubmit = name.trim() && email.trim() && password && (role === "admin" || clientId) && state.status !== "saving";

  async function submit() {
    if (!canSubmit) return;
    setState({ status: "saving" });
    const result = await createApplicationUser({
      fullName: name.trim(), email: email.trim(), password,
      role, clientId: role === "client" ? clientId : null,
    });
    if (!result.ok) {
      setState({ status: "error", message: result.error });
      return;
    }
    setState({ status: "success", auditRecorded: result.auditRecorded });
    setName(""); setEmail(""); setPassword(""); setClientId("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button onClick={() => { setOpen(true); setState({ status: "idle" }); }}>
          {t.adminUsersCreate}
        </Button>
      </div>
      {open ? (
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{t.adminUsersCreateTitle}</h2>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{t.adminUsersCancel}</Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium"><span>{t.adminUsersCreateName}</span><input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></label>
            <label className="flex flex-col gap-2 text-sm font-medium"><span>{t.adminUsersCreateEmail}</span><input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} /></label>
            <label className="flex flex-col gap-2 text-sm font-medium"><span>{t.adminUsersCreatePassword}</span><input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} /></label>
            <label className="flex flex-col gap-2 text-sm font-medium"><span>{t.adminUsersCreateRole}</span><select value={role} onChange={(e) => setRole(e.target.value as "admin" | "client")} className={inputClass}><option value="client">{t.adminUsersRoleClient}</option>{data.canCreateAdmin ? <option value="admin">{t.adminUsersRoleAdmin}</option> : null}</select></label>
            {role === "client" ? <label className="flex flex-col gap-2 text-sm font-medium"><span>{t.adminUsersCreateClient}</span><select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass}><option value="">{t.adminUsersCreateClient}</option>{data.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label> : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={submit} disabled={!canSubmit}>{state.status === "saving" ? t.adminUsersCreateSaving : t.adminUsersCreateSubmit}</Button>
            {state.status === "success" ? <p className="text-sm text-emerald-600">{state.auditRecorded ? t.adminUsersCreated : t.adminUsersCreatedAuditWarning}</p> : null}
            {state.status === "error" ? <p className="text-sm text-destructive">{state.message}</p> : null}
          </div>
        </section>
      ) : null}
      {data.users.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{t.adminUsersEmpty}</div> : <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-sm"><thead className="border-b border-border text-right text-muted-foreground"><tr><th className="p-3">{t.adminUsersName}</th><th className="p-3">{t.adminUsersEmail}</th><th className="p-3">{t.adminUsersRole}</th><th className="p-3">{t.adminUsersClient}</th><th className="p-3">{t.adminUsersCreatedAt}</th></tr></thead><tbody>{data.users.map((user) => <tr key={user.id} className="border-b border-border last:border-0"><td className="p-3">{user.fullName}</td><td className="p-3" dir="ltr">{user.email}</td><td className="p-3">{roleLabel(user.role, t)}</td><td className="p-3">{user.clientName ?? t.adminUsersNoClient}</td><td className="p-3">{new Intl.DateTimeFormat(lang === "fa" ? "fa-IR" : "en-US", { dateStyle: "medium" }).format(user.createdAt)}</td></tr>)}</tbody></table></div>}
    </div>
  );
}
