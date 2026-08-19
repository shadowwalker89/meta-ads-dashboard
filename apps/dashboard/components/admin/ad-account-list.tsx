"use client";

import { useState } from "react";
import type { AdAccount } from "@repo/shared";
import { Button } from "@/components/ui/button";
import { useDashboardLang } from "@/components/layout/language-provider";
import { tpl, type DashboardStrings } from "@/lib/i18n/strings";
import {
  updateAdAccountSource,
  updateAdAccountStatus,
} from "@/app/(dashboard)/admin/clients/actions";

const STATUS_STYLES: Record<AdAccount["status"], string> = {
  connected: "bg-emerald-500/15 text-emerald-600",
  pending: "bg-amber-500/15 text-amber-600",
  error: "bg-destructive/15 text-destructive",
};

/**
 * Presentational. Renders every ad account of a client as a card with its
 * source, Meta id and status, plus inline controls to set the Meta id and
 * flip the status. Mutations go through the server actions, never raw
 * repositories. The package limit is shown as informational context.
 */
export function AdAccountList({
  adAccounts,
  packageName,
  maxAdAccounts,
  limitReached,
  onCreate,
}: {
  adAccounts: AdAccount[];
  packageName: string | null;
  maxAdAccounts: number | null;
  limitReached: boolean;
  onCreate: () => void;
}) {
  const { strings: t } = useDashboardLang();
  const statusLabels: Record<AdAccount["status"], string> = {
    connected: t.statusConnected,
    pending: t.statusPending,
    error: t.statusError,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Button onClick={onCreate} disabled={limitReached}>
            {t.adAccountNew}
          </Button>
        </div>
        {maxAdAccounts !== null && (
          <p className="text-sm text-muted-foreground">
            {tpl(t.adAccountPackageLimit, {
              package: packageName ?? "",
              max: String(maxAdAccounts),
            })}
          </p>
        )}
      </div>

      {adAccounts.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
          {t.adAccountEmpty}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {adAccounts.map((adAccount) => (
            <AdAccountCard
              key={adAccount.id}
              adAccount={adAccount}
              statusLabels={statusLabels}
              strings={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AdAccountCard({
  adAccount,
  statusLabels,
  strings: t,
}: {
  adAccount: AdAccount;
  statusLabels: Record<AdAccount["status"], string>;
  strings: DashboardStrings;
}) {
  const [metaId, setMetaId] = useState(adAccount.metaAdAccountId ?? "");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSaveMetaId() {
    setBusy(true);
    setFeedback(null);
    const trimmed = metaId.trim();
    const result = await updateAdAccountSource(
      adAccount.id,
      adAccount.source,
      trimmed.length > 0 ? trimmed : null
    );
    setBusy(false);
    setFeedback(result.ok ? t.adAccountSaved : result.error);
  }

  async function handleStatusChange(next: AdAccount["status"]) {
    setBusy(true);
    setFeedback(null);
    const result = await updateAdAccountStatus(adAccount.id, next);
    setBusy(false);
    setFeedback(result.ok ? t.adAccountStatusUpdated : result.error);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{adAccount.name}</span>
          <span className="text-xs text-muted-foreground" dir="ltr">
            {adAccount.source}
          </span>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[adAccount.status]}`}
        >
          {statusLabels[adAccount.status]}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`meta-id-${adAccount.id}`}
          className="text-xs font-medium text-muted-foreground"
        >
          {t.adAccountMetaIdLabel}
        </label>
        <div className="flex gap-2">
          <input
            id={`meta-id-${adAccount.id}`}
            value={metaId}
            onChange={(event) => setMetaId(event.target.value)}
            placeholder={t.adAccountMetaIdPlaceholder}
            dir="ltr"
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
          />
          <Button
            size="sm"
            onClick={handleSaveMetaId}
            disabled={busy || metaId.trim() === (adAccount.metaAdAccountId ?? "")}
          >
            {t.adAccountSave}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t.adAccountStatusLabel}</span>
        {(["connected", "pending", "error"] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => handleStatusChange(status)}
            disabled={busy || status === adAccount.status}
            className={
              status === adAccount.status
                ? "text-primary font-medium"
                : "text-muted-foreground underline-offset-2 hover:underline"
            }
          >
            {statusLabels[status]}
          </button>
        ))}
      </div>

      {feedback && <p className="text-xs text-muted-foreground">{feedback}</p>}
    </div>
  );
}