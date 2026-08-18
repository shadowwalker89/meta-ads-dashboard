/**
 * Loading state for the dashboard route (shown by Next.js during
 * navigation). Mirrors the page layout with skeleton blocks so the
 * transition doesn't shift layout.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="flex flex-col gap-2">
            <div className="h-6 w-36 animate-pulse rounded-md bg-muted" />
            <div className="h-3.5 w-56 animate-pulse rounded-md bg-muted/70" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="h-3.5 w-52 animate-pulse rounded-md bg-muted/70" />
            <div className="h-3.5 w-40 animate-pulse rounded-md bg-muted/50" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border/60 pt-4">
          <div className="h-3.5 w-28 animate-pulse rounded-md bg-muted/70" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-32 animate-pulse rounded-lg bg-muted/70" />
            <div className="h-8 w-40 animate-pulse rounded-lg bg-muted/70" />
          </div>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex h-24 animate-pulse flex-col gap-2 rounded-lg border border-border bg-card p-3.5"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 rounded-md bg-muted" />
              <div className="size-6 rounded-md bg-muted/70" />
            </div>
            <div className="h-5 w-24 rounded-md bg-muted/70" />
            <div className="h-3 w-16 rounded-md bg-muted/50" />
          </div>
        ))}
      </div>

      <div className="flex h-52 animate-pulse flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="h-3.5 w-32 rounded-md bg-muted" />
            <div className="h-3 w-56 rounded-md bg-muted/50" />
          </div>
          <div className="h-8 w-24 rounded-md bg-muted/50" />
        </div>
        <div className="h-8 w-52 rounded-lg bg-muted/70" />
        <div className="flex-1 rounded-md bg-muted/30" />
      </div>

      <div className="flex h-44 animate-pulse flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-2">
          <div className="h-3.5 w-36 rounded-md bg-muted" />
          <div className="h-3 w-72 rounded-md bg-muted/50" />
        </div>
        <div className="flex-1 rounded-md bg-muted/30" />
      </div>
    </div>
  );
}