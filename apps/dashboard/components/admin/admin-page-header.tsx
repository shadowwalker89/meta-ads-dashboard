import type { ReactNode } from "react";

/**
 * Operational admin page header. Typography matches the client dashboard
 * hero (same scale, same tokens) but stays deliberately plain — no hero
 * glows/grid — so every Admin page reads as a management/control surface,
 * visually related to (but not a copy of) the client reporting hero.
 */
export function AdminPageHeader({
  title,
  subtitle,
  meta,
}: {
  title: string;
  subtitle?: string;
  /** Optional right-side controls (selectors, actions). */
  meta?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {meta ? (
        <div className="flex shrink-0 items-center gap-2">{meta}</div>
      ) : null}
    </div>
  );
}