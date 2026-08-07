import { chromium } from "playwright";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { getCollectorConfig } from "./config.js";

const userDataDir = resolve(process.env.COLLECTOR_USER_DATA_DIR ?? "./.collector-session");

/**
 * Run this ONCE (manually, on a machine with a display) before the
 * normal Collector run. It opens a real, visible browser window
 * pointed at the target URL; a human logs into Meta Ads Manager
 * themselves, then simply closes the window. Playwright saves the
 * resulting session (cookies, storage) into `userDataDir`, and every
 * later `pnpm run start` reuses it automatically.
 *
 * This script never sees, asks for, or stores a password — it only
 * opens a browser window for a human to use normally.
 */
async function main() {
  if (!existsSync(userDataDir)) {
    mkdirSync(userDataDir, { recursive: true });
  }

  console.log(`[Bootstrap] opening a visible browser window, session dir: ${userDataDir}`);
  console.log("[Bootstrap] log into Meta Ads Manager manually in the window that opens.");
  console.log("[Bootstrap] once logged in, simply close the browser window to save the session.");

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
  });

  const page = await context.newPage();
  await page.goto(getCollectorConfig().baseUrl);

  // Resolves once the human closes the browser window themselves.
  await new Promise<void>((resolveClose) => {
    context.on("close", () => resolveClose());
  });

  console.log("[Bootstrap] session saved. You can now run the collector normally.");
}

main().catch((err) => {
  console.error("[Bootstrap] failed:", err);
  process.exit(1);
});
