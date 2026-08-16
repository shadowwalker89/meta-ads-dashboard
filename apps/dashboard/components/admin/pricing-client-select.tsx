"use client";

import { useRouter } from "next/navigation";

export function PricingClientSelect({
  clients,
  selectedClientId,
  baseHref = "/dashboard/admin/pricing",
}: {
  clients: { id: string; name: string }[];
  selectedClientId: string | null;
  baseHref?: string;
}) {
  const router = useRouter();

  function handleChange(clientId: string) {
    if (clientId) {
      router.push(
        `${baseHref}?clientId=${encodeURIComponent(clientId)}`
      );
    } else {
      router.push(baseHref);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <label
        htmlFor="pricing-client-select"
        className="text-sm font-medium text-muted-foreground"
      >
        مشتری
      </label>
      <select
        id="pricing-client-select"
        value={selectedClientId ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        className="h-9 w-full max-w-sm rounded-md border border-border bg-background px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
      >
        <option value="">انتخاب مشتری...</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>
    </div>
  );
}