import Link from "next/link";
import type { ClientAdminEntry } from "@/lib/client-admin";
import { Button } from "@/components/ui/button";
import { deactivateClient } from "@/app/(dashboard)/admin/clients/actions";

/**
 * Presentational. Renders every client as a card with its package, active
 * status and ad-account count, plus an entry into its AdAccount
 * management page. Create/edit orchestration lives in the container
 * (ClientManagement); this component only renders and signals.
 */
export function ClientList({
  clients,
  canCreate,
  onCreate,
}: {
  clients: ClientAdminEntry[];
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {canCreate && (
        <div>
          <Button onClick={onCreate}>مشتری جدید</Button>
        </div>
      )}

      {clients.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
          هنوز هیچ مشتری‌ای تعریف نشده است.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => (
            <div
              key={client.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">{client.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {client.businessType}
                  </span>
                </div>
                <span
                  className={
                    client.isActive
                      ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600"
                      : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                  }
                >
                  {client.isActive ? "فعال" : "غیرفعال"}
                </span>
              </div>

              <div className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">
                  پکیج: <span className="text-foreground">{client.packageName ?? "—"}</span>
                </span>
                <span className="text-muted-foreground">
                  اکانت تبلیغاتی: <span className="text-foreground">{client.adAccountCount}</span>
                </span>
                <span className="text-muted-foreground">
                  ایمیل: <span className="text-foreground" dir="ltr">{client.contactEmail}</span>
                </span>
              </div>

              <div className="mt-auto flex gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link href={`/dashboard/admin/clients/${client.id}`}>
                    مدیریت اکانت‌ها
                  </Link>
                </Button>
                {canCreate && client.isActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm(`مشتری «${client.name}» غیرفعال شود؟`)) {
                        deactivateClient(client.id);
                      }
                    }}
                  >
                    غیرفعال
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}