import { FeatureSection } from "@/components/dashboard/feature-section";

/**
 * Advanced-reporting surface, gated behind the package
 * `advancedReporting` feature flag by the dashboard page. Presentational
 * placeholder only — it never invents new Meta metrics or daily trends.
 * This is the boundary that will host the real advanced-reporting
 * implementation later.
 */
export function AdvancedReportingSection() {
  return (
    <FeatureSection
      title="گزارش پیشرفته"
      description="گزارش‌های تحلیلی فراتر از شاخص‌های اصلی"
      emptyState="گزارش پیشرفته به‌زودی در این بخش ارائه می‌شود."
    />
  );
}