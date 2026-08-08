import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { BrowserSessionManager } from "./browser-session-manager.js";
import { getCollectorConfig } from "./config.js";

/**
 * One-off debug script — NOT part of the normal Collector flow.
 * Saves three artifacts using the real, already-logged-in persistent
 * session, so the actual DOM of a populated campaign table can be
 * inspected and turned into real selectors — instead of guessing:
 *
 *   1. A full-page screenshot (visual confirmation).
 *   2. The entire page HTML (thorough manual inspection fallback).
 *   3. Just the campaign table's HTML, if an element with an ARIA
 *      "table" role is found (best-effort — Meta's UI may not use
 *      this exact pattern, in which case use file #2 instead).
 *
 * Delete this file once meta-ads-scraper.ts has real selectors
 * written against a confirmed, populated table — it's a one-time
 * inspection tool, not production code.
 */
async function main() {
  const sessionManager = new BrowserSessionManager();
  const context = await sessionManager.getContext();
  const page = await context.newPage();

  const targetUrl = getCollectorConfig().baseUrl;
  console.log(`[Debug] navigating to: ${targetUrl}`);

  await page.goto(targetUrl, { waitUntil: "load", timeout: 30000 });
  // Give client-side rendered content a moment to finish, without
  // waiting for network-idle which can hang on polling/websockets.
  await page.waitForTimeout(3000);

  const screenshotPath = resolve("./.collector-session-debug.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const title = await page.title();
  const currentUrl = page.url();
  console.log(`[Debug] page title: ${title}`);
  console.log(`[Debug] final URL after navigation: ${currentUrl}`);
  console.log(`[Debug] screenshot saved to: ${screenshotPath}`);

  const fullHtmlPath = resolve("./.collector-session-debug-full.html");
  const fullHtml = await page.content();
  writeFileSync(fullHtmlPath, fullHtml, "utf-8");
  console.log(`[Debug] full page HTML saved to: ${fullHtmlPath}`);

  try {
    const table = page.getByRole("table").first();
    await table.waitFor({ state: "visible", timeout: 5000 });
    const tableHtml = await table.evaluate((el) => el.outerHTML);
    const tablePath = resolve("./.collector-session-debug-table.html");
    writeFileSync(tablePath, tableHtml, "utf-8");
    console.log(`[Debug] campaign table HTML saved to: ${tablePath}`);
  } catch {
    console.log(
      "[Debug] no element with role=table found — use the full page HTML file instead"
    );
  }

  await page.close();
  await sessionManager.shutdown();
}

main().catch((err) => {
  console.error("[Debug] failed:", err);
  process.exit(1);
});
