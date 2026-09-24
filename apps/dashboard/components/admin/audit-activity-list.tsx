import Link from "next/link";
import { History } from "lucide-react";
import type { AuditActivityPage } from "@/lib/audit-activity";
import { formatDateTime } from "@/lib/i18n/format";
import { tpl, type AppLanguage, type DashboardStrings } from "@/lib/i18n/strings";
import { Button } from "@/components/ui/button";

export function AuditActivityList({
  page,
  lang,
  strings: t,
  clientId,
  cursor,
}: {
  page: AuditActivityPage;
  lang: AppLanguage;
  strings: DashboardStrings;
  clientId: string;
  cursor?: string | null;
}) {
  const baseHref = `/admin/clients/${clientId}`;
  const loadMoreHref = page.nextCursor
    ? `${baseHref}?cursor=${encodeURIComponent(page.nextCursor)}`
    : null;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-base font-semibold">{t.auditActivityTitle}</h2>
          <p className="text-xs text-muted-foreground">
            {t.auditActivityDescription}
          </p>
        </div>
        <History className="size-5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
      </div>

      {page.entries.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
          {t.auditActivityEmpty}
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {page.entries.map((entry) => {
            const actorLabel = entry.actorName
              ? tpl(t.auditActivityByActor, { actor: entry.actorName })
              : t.auditActivityActorFallback;
            return (
              <li key={entry.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-sm font-medium text-foreground">
                    {entry.actionLabel}
                  </span>
                  <time
                    dateTime={entry.createdAt.toISOString()}
                    className="text-xs tabular-nums text-muted-foreground"
                  >
                    {formatDateTime(lang, entry.createdAt)}
                  </time>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{actorLabel}</span>
                  {entry.metadataSummary ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-foreground/80">
                        {entry.metadataSummary}
                      </span>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {loadMoreHref && (!cursor || cursor !== page.nextCursor) ? (
        <div className="flex justify-center pt-1">
          <Button asChild variant="outline" size="sm">
            <Link href={loadMoreHref}>{t.auditActivityLoadMore}</Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
