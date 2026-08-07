import type { Page } from "playwright";
import type { CollectorProvider } from "./collector-provider.js";
import type { BrowserSessionManager } from "./browser-session-manager.js";
import { PLACEHOLDER_URL } from "./constants.js";

/**
 * Sprint 4 scope: prove the browser lifecycle (launch → context →
 * page → close) works end-to-end. NO Meta login, NO selectors,
 * NO real scraping — that's explicitly a later sprint.
 */
export class PlaywrightCollector implements CollectorProvider {
  constructor(private readonly sessionManager: BrowserSessionManager) {}

  async collect(adAccountId: string): Promise<void> {
    console.log(`[PlaywrightCollector] starting collect for adAccountId=${adAccountId}`);

    const context = await this.sessionManager.createContext();
    let page: Page | null = null;

    try {
      page = await context.newPage();
      console.log(`[PlaywrightCollector] opening placeholder page: ${PLACEHOLDER_URL}`);
      await page.goto(PLACEHOLDER_URL);
      console.log("[PlaywrightCollector] placeholder page opened successfully");

      // Intentionally nothing else here yet — no Meta login,
      // no data extraction. This proves the plumbing works.
    } finally {
      if (page) {
        console.log("[PlaywrightCollector] closing page");
        await page.close();
      }
      await this.sessionManager.closeContext(context);
      console.log(`[PlaywrightCollector] collect finished for adAccountId=${adAccountId}`);
    }
  }
}
