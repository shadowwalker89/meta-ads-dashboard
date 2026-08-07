import { resolve } from "node:path";
import { BrowserSessionManager } from "./browser-session-manager.js";
import { getCollectorConfig } from "./config.js";

/**
 * One-off debug script — NOT part of the normal Collector flow, and
 * not something session-check.ts or the Orchestrator ever calls.
 *
 * Opens the configured target URL using the exact same persistent
 * session the real Collector uses, then saves a screenshot plus the
 * page title/URL — so a human can visually confirm whether Playwright
 * actually sees a logged-in Meta Ads Manager session or a login page,
 * instead of guessing. Delete this file once session-check.ts has
 * real selectors written against a confirmed logged-in page.
 */
async function main() {
  const sessionManager = new BrowserSessionManager();
  const context = await sessionManager.getContext();
  const page = await context.newPage();

  const targetUrl = getCollectorConfig().baseUrl;
  console.log(`[Debug] navigating to: ${targetUrl}`);

  await page.goto(targetUrl, { waitUntil: "load", timeout: 30000 });
  // Give client-side rendered content (very common on Meta's UI) a
  // moment to finish, without waiting for network-idle which can hang
  // indefinitely on pages with polling/websockets.
  await page.waitForTimeout(3000);

  const screenshotPath = resolve("./.collector-session-debug.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const title = await page.title();
  const currentUrl = page.url();

  console.log(`[Debug] page title: ${title}`);
  console.log(`[Debug] final URL after navigation: ${currentUrl}`);
  console.log(`[Debug] screenshot saved to: ${screenshotPath}`);

  await page.close();
  await sessionManager.shutdown();
}

main().catch((err) => {
  console.error("[Debug] failed:", err);
  process.exit(1);
});
