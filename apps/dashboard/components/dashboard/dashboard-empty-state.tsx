import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Presentational empty/error state for dashboard sections. Renders a
 * dashed panel with an optional icon, a primary message, and an optional
 * hint. Never fabricates data — callers pass the exact message they want.
 */
export function DashboardEmptyState({
  icon: Icon = Inbox,
  message,
  hint,
  tone = "muted",
  className,
}: {
  icon?: LucideIcon;
  message: string;
  hint?: string;
  tone?: "muted" | "destructive";
  className?: string;
}) {
  const isDestructive = tone === "destructive";
  return (
    <div
      data-slot="dashboard-empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center",
        isDestructive
          ? "border-destructive/40 bg-destructive/5 text-destructive"
          : "border-border bg-muted/40 text-muted-foreground",
        className
      )}
    >
      <Icon
        className={cn(
          "size-6",
          isDestructive
            ? "text-destructive"
            : "text-muted-foreground/60"
        )}
        aria-hidden="true"
      />
      <p className="text-sm font-medium">{message}</p>
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}