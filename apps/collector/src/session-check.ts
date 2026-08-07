import type { Page } from "playwright";

/**
 * Placeholder abstraction. Real Meta Ads Manager login-state detection
 * requires inspecting the actual Meta DOM, which was not available
 * while building this sprint — so no selector is guessed here (per
 * Sprint 5 rules: never present a fabricated selector as real).
 *
 * Until this is filled in, it always reports "not logged in", which
 * makes PlaywrightCollector fail gracefully and log clearly instead
 * of silently scraping nothing or crashing.
 */
export async function isSessionLoggedIn(_page: Page): Promise<boolean> {
  console.warn(
    "[Collector] isSessionLoggedIn() is a placeholder — real Meta login-state detection is not implemented yet"
  );
  return false;
}
