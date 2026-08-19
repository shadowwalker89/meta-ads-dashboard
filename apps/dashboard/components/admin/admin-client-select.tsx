"use client";

import { useRouter } from "next/navigation";
import { useDashboardLang } from "@/components/layout/language-provider";

/**
 * Shared admin client selector. Bilingual (reads the dashboard language
 * from the provider) and renders as a compact labeled select; navigating
 * pushes `{baseHref}?clientId=...` so every admin page keeps its own
 * explicit base route (never a hardcoded one).
 */
export function AdminClientSelect({
  clients,
  selectedClientId,
  baseHref,
  id = "admin-client-select",
}: {
  clients: { id: string; name: string }[];
  selectedClientId: string | null;
  baseHref: string;
  id?: string;
}) {
  const router = useRouter();
  const { strings: t } = useDashboardLang();

  function handleChange(clientId: string) {
    if (clientId) {
      router.push(`${baseHref}?clientId=${encodeURIComponent(clientId)}`);
    } else {
      router.push(baseHref);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-xs font-medium text-muted-foreground"
      >
        {t.adminSelectClient}
      </label>
      <select
        id={id}
        value={selectedClientId ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        className="h-8 w-full max-w-xs rounded-md border border-border bg-background px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
      >
        <option value="">{t.adminSelectClientPlaceholder}</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>
    </div>
  );
}