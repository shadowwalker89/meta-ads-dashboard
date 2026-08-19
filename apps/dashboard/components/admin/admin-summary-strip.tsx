import type { LucideIcon } from "lucide-react";

/**
 * Operational summary strip for the Admin Overview. Renders compact
 * count chips (clients / ad accounts / packages / campaigns) from data
 * the server already loaded — purely presentational, no data reads.
 */
export function AdminSummaryStrip({
  items,
}: {
  items: { label: string; value: string; icon?: LucideIcon }[];
}) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(({ label, value, icon: Icon }) => (
        <div
          key={label}
          className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card p-3 shadow-sm"
        >
          <span className="flex items-center gap-1.5 text-[0.72rem] font-medium text-muted-foreground">
            {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
            <span className="truncate">{label}</span>
          </span>
          <span className="truncate text-lg font-semibold tabular-nums">
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}