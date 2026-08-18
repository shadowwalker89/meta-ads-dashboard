import { FeatureSection } from "@/components/dashboard/feature-section";
import {
  DASHBOARD_STRINGS,
  type AppLanguage,
} from "@/lib/i18n/strings";

/**
 * Advanced-reporting surface, gated behind the package
 * `advancedReporting` feature flag by the dashboard page. Presentational
 * placeholder only — it never invents new Meta metrics or daily trends.
 * This is the boundary that will host the real advanced-reporting
 * implementation later.
 */
export function AdvancedReportingSection({
  lang = "fa",
}: {
  lang?: AppLanguage;
}) {
  const t = DASHBOARD_STRINGS[lang];
  return (
    <FeatureSection
      title={t.advancedTitle}
      description={t.advancedDescription}
      emptyState={t.advancedEmpty}
    />
  );
}