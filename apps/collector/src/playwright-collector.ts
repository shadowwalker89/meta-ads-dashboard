import type { Page } from "playwright";
import type { CollectorProvider } from "./collector-provider.js";
import type { BrowserSessionManager } from "./browser-session-manager.js";
import type { RawCampaignMetrics } from "./raw-campaign-metrics.js";
import { getCollectorConfig } from "./config.js";
import { isSessionLoggedIn } from "./session-check.js";
import { scrapeCampaignTable } from "./meta-ads-scraper.js";

/**
 * Sprint 5 scope: real browser lifecycle with a persistent, reused
 * session. Still NO automated login — if the session isn't already
 * logged in (via the headful bootstrap script), this fails loudly
 * (throws) instead of guessing selectors or attempting a login.
 *
 * IMPORTANT: this throws rather than returning an empty array when
 * the session isn't logged in. Returning [] would look identical to
 * "zero campaigns found on an otherwise fine account" — CollectorJob
 * would get marked "success" even though nothing actually worked.
 * Throwing lets CollectorOrchestrator's existing try/catch mark the
 * job "failed" with a real error message, which is what actually
 * happened.
 */
export class PlaywrightCollector implements CollectorProvider {
  constructor(private readonly sessionManager: BrowserSessionManager) {}

  async collect(adAccountId: string): Promise<RawCampaignMetrics[]> {
    console.log("[Collector] starting...");
    console.log(
      `[Collector] using persistent session: ${this.sessionManager.userDataDirPath}`
    );

    const context = await this.sessionManager.getContext();
    const targetUrl = getCollectorConfig().adAccountReportUrl(adAccountId);

    let page: Page | null = null;
    try {
      page = await context.newPage();
      console.log(`[Collector] opening Ad Account: ${adAccountId}`);
      await page.goto(targetUrl);

      const loggedIn = await isSessionLoggedIn(page);
      if (!loggedIn) {
        throw new Error(
          "Session is not logged in. Run `pnpm run bootstrap-session` once to log in manually, then retry."
        );
      }

      const rows = await scrapeCampaignTable(page);
      console.log(`[Collector] campaign rows found: ${rows.length}`);
      return rows;
    } finally {
      if (page) {
        await page.close();
      }
      console.log(`[Collector] finished for adAccountId=${adAccountId}`);
    }
  }
}