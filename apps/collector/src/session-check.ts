import type { Page } from "playwright";

/**
 * Corrected against the real page HTML (Sprint 5 troubleshooting,
 * 2026-08-09): the sidebar "Campaigns" nav item is a plain `<div>`
 * with no ARIA link/button role at all —
 *   <div class="x1vvvo52 ..." id="js_b">Campaigns</div>
 * Meta's Comet UI uses div-based, JS-driven nav items rather than
 * semantic `<a>` tags. The earlier `getByRole("link", ...)` version
 * was a reasonable-looking guess that turned out wrong once actually
 * checked against the DOM — this version matches on visible text
 * instead, which doesn't depend on role at all. `.first()` is used
 * because the same text also appears later as a page heading once
 * you're on the Campaigns page; the sidebar nav item renders earlier
 * in the DOM.
 *
 * We only have direct evidence of the logged-in state — no confirmed
 * screenshot of a logged-out/login page exists yet. Rather than guess
 * what that looks like, "the known logged-in indicator didn't appear
 * within a reasonable timeout" is treated as not-logged-in.
 */
export async function isSessionLoggedIn(page: Page, timeoutMs = 90_000): Promise<boolean> {
  try {
    await page
      .getByText("Campaigns", { exact: true })
      .first()
      .waitFor({ state: "visible", timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}
