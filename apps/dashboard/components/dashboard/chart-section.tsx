import { FeatureSection } from "@/components/dashboard/feature-section";

/**
 * Chart surface, gated behind the package `charts` feature flag by the
 * dashboard page. Presentational placeholder only — it never renders
 * fabricated time-series data or daily-trend charts. This is the
 * boundary that will host the real chart implementation later.
 */
export function ChartSection() {
  return (
    <FeatureSection
      title="نمودارها"
      description="خلاصه‌ی دیداری عملکرد کمپین‌ها"
      emptyState="نمودارها به‌زودی در این بخش نمایش داده می‌شوند."
    />
  );
}