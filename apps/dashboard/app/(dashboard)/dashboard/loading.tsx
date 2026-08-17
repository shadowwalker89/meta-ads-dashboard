/**
 * Loading state for the dashboard route (shown by Next.js during
 * navigation). Mirrors the page layout with skeleton blocks so the
 * transition doesn't shift layout.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded-md bg-muted/70" />
      </div>

      <div className="h-9 w-56 animate-pulse rounded-lg bg-muted/70" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex h-28 animate-pulse flex-col gap-3 rounded-lg border border-border bg-card p-4"
          >
            <div className="h-4 w-24 rounded-md bg-muted" />
            <div className="h-6 w-32 rounded-md bg-muted/70" />
            <div className="h-3 w-20 rounded-md bg-muted/50" />
          </div>
        ))}
      </div>

      <div className="flex h-64 animate-pulse flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <div className="h-4 w-32 rounded-md bg-muted" />
        <div className="h-3 w-56 rounded-md bg-muted/50" />
        <div className="mt-2 flex-1 rounded-md bg-muted/30" />
      </div>
    </div>
  );
}