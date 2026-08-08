// No real Meta Ads Manager URL is hardcoded anywhere in the Collector.
// Set COLLECTOR_TARGET_BASE_URL in your environment once the real
// target is known. Everything defaults to a harmless placeholder
// until then.
const DEFAULT_BASE_URL = "https://example.com/placeholder-ads-manager";

// Meta's Ads Manager UI (Comet) is a heavy client-rendered app. On a
// small VPS (1 vCPU / 4GB observed to take 50-90s), Playwright's
// default 30s navigation timeout isn't enough. Configurable via env
// so it can be tuned per-machine without touching code.
const DEFAULT_NAVIGATION_TIMEOUT_MS = 90_000;

export function getCollectorConfig() {
  const baseUrl = process.env.COLLECTOR_TARGET_BASE_URL ?? DEFAULT_BASE_URL;
  const navigationTimeoutMs = process.env.COLLECTOR_NAVIGATION_TIMEOUT_MS
    ? Number(process.env.COLLECTOR_NAVIGATION_TIMEOUT_MS)
    : DEFAULT_NAVIGATION_TIMEOUT_MS;

  return {
    baseUrl,
    navigationTimeoutMs,
    adAccountReportUrl(adAccountId: string): string {
      return `${baseUrl}/ad-accounts/${adAccountId}/campaigns`;
    },
  };
}
