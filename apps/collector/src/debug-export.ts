import { resolve } from "node:path";
import { BrowserSessionManager } from "./browser-session-manager.js";
import { getCollectorConfig } from "./config.js";

/**
 * One-off debug script — NOT part of the normal Collector flow.
 * Clicks Meta Ads Manager's "Quick export" button and reports what
 * actually happens: a direct file download, or something else (a
 * menu/dialog) that needs a follow-up click. Purely observational —
 * no parsing logic yet, so we build the real export flow from
 * evidence instead of guessing.
 *
 * Selector basis: found directly in the real page HTML (Sprint 5
 * troubleshooting, 2026-08-08) via a stable `data-surface` attribute:
 *   data-surface="/am/table/tool_bar/lib:quick-export-button"
 * This is one of Meta's own internal instrumentation hooks, not a
 * generated atomic CSS class — much less likely to change on a
 * routine deploy than something like `_4lg0` or `x1vvvo52`.
 *
 * NOTE: the first run of this script showed a genuine "Exporting
 * table data" progress toast — the export IS real and working, it
 * just takes longer than 15s to finish generating on this VPS's
 * limited CPU. The download wait below now matches the same
 * generous timeout used for page navigation (config.navigationTimeoutMs).
 */
async function main() {
  const config = getCollectorConfig();
  const sessionManager = new BrowserSessionManager();
  const context = await sessionManager.getContext();
  const page = await context.newPage();

  console.log(`[Debug] navigating to: ${config.baseUrl}`);
  await page.goto(config.baseUrl, {
    waitUntil: "domcontentloaded",
    timeout: config.navigationTimeoutMs,
  });
  await page.waitForTimeout(5000);

  const exportButton = page.locator(
    '[data-surface="/am/table/tool_bar/lib:quick-export-button"]'
  );
  const found = (await exportButton.count()) > 0;
  console.log(`[Debug] export button found: ${found}`);

  if (!found) {
    const notFoundPath = resolve("./.collector-export-debug-notfound.png");
    await page.screenshot({ path: notFoundPath, fullPage: true });
    console.log(`[Debug] screenshot saved to: ${notFoundPath}`);
    await sessionManager.shutdown();
    return;
  }

  // Give the export as long as we give page navigation — the previous
  // run proved 15s isn't enough on this machine.
  const downloadPromise = page
    .waitForEvent("download", { timeout: config.navigationTimeoutMs })
    .catch(() => null);

  await exportButton.first().click();
  console.log("[Debug] clicked export button, waiting for download (this can take a while)...");

  const download = await downloadPromise;

  if (download) {
    const suggested = download.suggestedFilename();
    const downloadPath = resolve(`./.collector-export-debug-${suggested}`);
    await download.saveAs(downloadPath);
    console.log(`[Debug] file downloaded: ${downloadPath}`);
    console.log(`[Debug] suggested filename was: ${suggested}`);
  } else {
    console.log(
      `[Debug] no download within ${config.navigationTimeoutMs}ms — saving a screenshot to see the current state`
    );
    const afterClickPath = resolve("./.collector-export-debug-after-click.png");
    await page.screenshot({ path: afterClickPath, fullPage: true });
    console.log(`[Debug] screenshot saved to: ${afterClickPath}`);
  }

  await page.close();
  await sessionManager.shutdown();
}

main().catch((err) => {
  console.error("[Debug] failed:", err);
  process.exit(1);
});
