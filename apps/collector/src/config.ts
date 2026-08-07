// No real Meta Ads Manager URL is hardcoded anywhere in the Collector.
// Set COLLECTOR_TARGET_BASE_URL in your environment once the real
// target is known. Everything defaults to a harmless placeholder
// until then.
const DEFAULT_BASE_URL = "https://example.com/placeholder-ads-manager";

export function getCollectorConfig() {
  const baseUrl = process.env.COLLECTOR_TARGET_BASE_URL ?? DEFAULT_BASE_URL;

  return {
    baseUrl,
    adAccountReportUrl(adAccountId: string): string {
      return `${baseUrl}/ad-accounts/${adAccountId}/campaigns`;
    },
  };
}
