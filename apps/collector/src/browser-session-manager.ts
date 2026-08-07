import { chromium, type Browser, type BrowserContext } from "playwright";

/**
 * Owns exactly one Chromium instance for the whole collector run.
 * Nothing outside this class touches `chromium` directly — that's
 * what keeps Playwright as an implementation detail instead of
 * something PlaywrightCollector (or anything else) has to manage.
 */
export class BrowserSessionManager {
  private browser: Browser | null = null;

  async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      console.log("[BrowserSessionManager] launching Chromium...");
      this.browser = await chromium.launch({ headless: true });
      console.log("[BrowserSessionManager] Chromium launched");
    }
    return this.browser;
  }

  async createContext(): Promise<BrowserContext> {
    const browser = await this.getBrowser();
    console.log("[BrowserSessionManager] creating new browser context");
    return browser.newContext();
  }

  async closeContext(context: BrowserContext): Promise<void> {
    console.log("[BrowserSessionManager] closing browser context");
    await context.close();
  }

  async shutdown(): Promise<void> {
    if (this.browser) {
      console.log("[BrowserSessionManager] closing Chromium");
      await this.browser.close();
      this.browser = null;
    }
  }
}
