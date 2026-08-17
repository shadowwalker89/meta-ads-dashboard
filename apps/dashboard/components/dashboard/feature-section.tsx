export interface FeatureSectionProps {
  /** عنوان بخش، مثلا "نمودارها". */
  title: string;
  /** توضیح کوتاه زیر عنوان. */
  description?: string;
  /** پیام وضعیت خالی — هیچ داده‌ی ساختگی در این بخش رندر نمی‌شود. */
  emptyState: string;
}

/**
 * Presentational shell for a feature surface that is gated behind a
 * Package feature flag. It renders only a titled section with an honest
 * empty state — it never fabricates charts, metrics, or export content.
 * The page decides whether to mount it based on the server-resolved
 * feature entitlements (lib/package-features.ts); this component has no
 * knowledge of packages, access, or the database.
 */
export function FeatureSection({
  title,
  description,
  emptyState,
}: FeatureSectionProps) {
  return (
    <section
      data-slot="feature-section"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div
        data-slot="feature-empty-state"
        className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground"
      >
        {emptyState}
      </div>
    </section>
  );
}