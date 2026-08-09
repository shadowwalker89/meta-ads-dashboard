import type { Page } from "playwright";
import type { AdAccount } from "@repo/shared";
import type { CollectorProvider } from "./collector-provider.js";
import type { BrowserSessionManager } from "./browser-session-manager.js";
import type { RawCampaignMetrics } from "./raw-campaign-metrics.js";
import { getCollectorConfig } from "./config.js";
import { isSessionLoggedIn } from "./session-check.js";
import { scrapeCampaignTable } from "./meta-ads-scraper.js";

/**
 * Real browser lifecycle with a persistent, reused session. Still NO
 * automated login — if the session isn't already logged in (via the
 * headful bootstrap script), this fails loudly (throws) instead of
 * guessing selectors or attempting a login.
 *
 * Throws rather than returning an empty array when the session isn't
 * logged in: returning [] would look identical to "zero campaigns on
 * an otherwise fine account" and CollectorJob would get marked
 * "success" even though nothing actually worked. Throwing lets
 * CollectorOrchestrator's existing try/catch mark the job "failed"
 * with a real error message, which is what actually happened.
 */
export class PlaywrightCollector implements CollectorProvider {
  constructor(private readonly sessionManager: BrowserSessionManager) {}

  async collect(adAccount: AdAccount): Promise<RawCampaignMetrics[]> {
    console.log("[Collector] starting...");
    console.log(
      `[Collector] using persistent session: ${this.sessionManager.userDataDirPath}`
    );

    if (!adAccount.metaAdAccountId) {
      throw new Error(
        `AdAccount ${adAccount.id} has no metaAdAccountId set — cannot build a Meta Ads Manager URL. Set it via AdAccountRepository.updateSource() first.`
      );
    }

    const config = getCollectorConfig();
    const context = await this.sessionManager.getContext();
    const targetUrl = config.adAccountReportUrl(adAccount.metaAdAccountId);

    let page: Page | null = null;
    try {
      page = await context.newPage();
      console.log(`[Collector] opening Ad Account: ${adAccount.id} → ${targetUrl}`);
      // domcontentloaded rather than the default "load": Meta's Comet
      // UI keeps background requests/websockets going indefinitely,
      // so "load" may never fire even though the page is usable.
      await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: config.navigationTimeoutMs,
      });

      const loggedIn = await isSessionLoggedIn(page, config.navigationTimeoutMs);
      if (!loggedIn) {
        throw new Error(
          "Session is not logged in. Run `pnpm run bootstrap-session` once to log in manually, then retry."
        );
      }

      const rows = await scrapeCampaignTable(page, config.navigationTimeoutMs);
      console.log(`[Collector] campaign rows found: ${rows.length}`);
      return rows;
    } finally {
      if (page) {
        await page.close();
      }
      console.log(`[Collector] finished for adAccountId=${adAccount.id}`);
    }
  }
}
