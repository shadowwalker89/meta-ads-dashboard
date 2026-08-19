"use client";

import type { Package } from "@repo/shared";
import { Button } from "@/components/ui/button";
import { useDashboardLang } from "@/components/layout/language-provider";
import { PackageSettingsPreview } from "@/components/admin/package-settings-preview";
import { formatRuleEffectiveDate } from "@/lib/pricing-format";
import type { ClientAssignmentEntry } from "@/lib/package-admin";

/**
 * Presentational. The client → package assignment workflow surface:
 * client picker, the client's current package + assignment timestamp,
 * a target-package picker, and a preview of the selected package's
 * effective settings. It is controlled — state and the server action
 * call live in PackageAssignmentWorkflow — so it renders safely without
 * a server action dependency.
 */
export function PackageAssignmentPanel({
  clients,
  packages,
  selectedClientId,
  selectedPackageId,
  busy,
  success,
  error,
  onClientChange,
  onPackageChange,
  onAssign,
}: {
  clients: ClientAssignmentEntry[];
  packages: Package[];
  selectedClientId: string;
  selectedPackageId: string | null;
  busy: boolean;
  success: string | null;
  error: string | null;
  onClientChange: (clientId: string) => void;
  onPackageChange: (packageId: string) => void;
  onAssign: () => void;
}) {
  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;
  const selectedPackage = packages.find((pkg) => pkg.id === selectedPackageId) ?? null;
  const canAssign = selectedClientId !== "" && selectedPackageId !== null && !busy;
  const { strings: t } = useDashboardLang();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
        <label htmlFor="assignment-client-select" className="text-sm font-medium text-muted-foreground">
          {t.assignSelectClient}
        </label>
        <select
          id="assignment-client-select"
          value={selectedClientId}
          onChange={(e) => onClientChange(e.target.value)}
          className="h-9 w-full max-w-sm rounded-md border border-border bg-background px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
        >
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-muted-foreground">{t.packageCurrent}</h2>
        {selectedClient ? (
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-base font-semibold">
              {selectedClient.packageName ?? t.assignNoPackage}
            </span>
            {selectedClient.packageAssignedAt ? (
              <span className="text-xs text-muted-foreground">
                {t.packageAssignedAt}: {formatRuleEffectiveDate(selectedClient.packageAssignedAt)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                {t.packageAssignedAt}: —
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t.assignNoClientSelected}</p>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
        <label htmlFor="assignment-package-select" className="text-sm font-medium text-muted-foreground">
          {t.assignNewPackage}
        </label>
        <select
          id="assignment-package-select"
          value={selectedPackageId ?? ""}
          onChange={(e) => onPackageChange(e.target.value)}
          className="h-9 w-full max-w-sm rounded-md border border-border bg-background px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
        >
          <option value="">{t.assignSelectPackagePlaceholder}</option>
          {packages.map((pkg) => (
            <option key={pkg.id} value={pkg.id}>
              {pkg.name}
            </option>
          ))}
        </select>
      </div>

      {selectedPackage && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t.assignPreviewTitle}
          </h2>
          <PackageSettingsPreview pkg={selectedPackage} />
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={onAssign} disabled={!canAssign}>
          {busy ? t.assignButtonBusy : t.assignButton}
        </Button>
        {success && <p className="text-sm text-emerald-600">{success}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}