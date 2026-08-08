import type { Page } from "playwright";

/**
 * Confirmed against a real, manually-verified logged-in screenshot
 * from Sprint 5 troubleshooting (2026-08-07): the left sidebar always
 * shows a "Campaigns" navigation link when a session is genuinely
 * logged into Meta Ads Manager. This uses a text/role-based locator
 * (not a generated CSS class name), which is far less fragile.
 *
 * We only have direct evidence of the logged-in state — no confirmed
 * screenshot of a logged-out/login page exists yet. Rather than guess
 * what that looks like, "the known logged-in indicator didn't appear
 * within a reasonable timeout" is treated as not-logged-in. This errs
 * safely for the login page, a checkpoint/2FA prompt, a network
 * failure, or any unexpected Meta UI state — all of them correctly
 * fail closed instead of being misread as success.
 *
 * timeoutMs defaults large (see config.ts) because Meta's Comet UI is
 * genuinely slow to finish rendering on a small VPS.
 */
export async function isSessionLoggedIn(page: Page, timeoutMs = 90_000): Promise<boolean> {
  try {
    await page
      .getByRole("link", { name: "Campaigns", exact: true })
      .waitFor({ state: "visible", timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}
