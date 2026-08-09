// No real Meta Ads Manager URL was hardcoded while its format was
// still unconfirmed. It's now confirmed (Sprint 5 troubleshooting,
// 2026-08-08): Meta Ads Manager identifies an ad account via a
// `?act=<numeric id>` query parameter, not a REST-style path segment.
// Still overridable via env for flexibility (different domains, etc.).
const DEFAULT_ADS_MANAGER_CAMPAIGNS_BASE_URL =
  "https://adsmanager.facebook.com/adsmanager/manage/campaigns";

// Used directly by one-off debug scripts (paste a full test URL,
// including any query string, and point them there).
const DEFAULT_DEBUG_BASE_URL = "https://example.com/placeholder-ads-manager";

// Meta's Ads Manager UI (Comet) is a heavy client-rendered app. On a
// small VPS (1 vCPU / 4GB observed to take 50-90s), Playwright's
// default 30s navigation timeout isn't enough. Configurable via env
// so it can be tuned per-machine without touching code.
const DEFAULT_NAVIGATION_TIMEOUT_MS = 90_000;

export function getCollectorConfig() {
  const baseUrl = process.env.COLLECTOR_TARGET_BASE_URL ?? DEFAULT_DEBUG_BASE_URL;

  const adsManagerCampaignsBaseUrl =
    process.env.COLLECTOR_ADS_MANAGER_BASE_URL ?? DEFAULT_ADS_MANAGER_CAMPAIGNS_BASE_URL;

  const navigationTimeoutMs = process.env.COLLECTOR_NAVIGATION_TIMEOUT_MS
    ? Number(process.env.COLLECTOR_NAVIGATION_TIMEOUT_MS)
    : DEFAULT_NAVIGATION_TIMEOUT_MS;

  return {
    // Used only by the one-off debug-session/debug-export scripts.
    baseUrl,
    navigationTimeoutMs,
    /**
     * Builds the real per-AdAccount Meta Ads Manager URL from its
     * Meta numeric account id (AdAccount.metaAdAccountId) — e.g.
     * "2001900877879672" → ".../campaigns?act=2001900877879672".
     */
    adAccountReportUrl(metaAdAccountId: string): string {
      return `${adsManagerCampaignsBaseUrl}?act=${metaAdAccountId}`;
    },
  };
}
