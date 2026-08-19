/**
 * Pure reporting-period math for the dashboard. No I/O, no server
 * context — every function is deterministic given its inputs, which
 * makes the period semantics unit-testable in isolation.
 *
 * Date conventions: the project stores timestamps as absolute UTC
 * instants (ISO-8601 strings at rest, `Date` in memory). All arithmetic
 * here operates on `Date.getTime()` (UTC milliseconds), so no local
 * timezone is ever consulted and no DST/timezone surprise can leak in.
 *
 * A reporting period is a trailing window `[from, to]` over snapshot
 * `captured_at` values — it selects readings by WHEN they were
 * collected, matching the cumulative/as-of snapshot semantics. A
 * snapshot's own reporting window (reporting_from/reporting_to) is now
 * stored, but it is never implied here: a snapshot without stored
 * bounds is never labeled as covering a window just because it was
 * captured recently.
 */

export interface DashboardRange {
  from: Date;
  to: Date;
}

/** The supported reporting periods, in days. */
export type ReportingPeriod = 7 | 30 | 90;

export const REPORTING_PERIODS: readonly ReportingPeriod[] = [7, 30, 90];

/** Safe fallback when no/unknown range parameter is supplied. */
export const DEFAULT_REPORTING_PERIOD: ReportingPeriod = 30;

/** Whitelist guard for the `?range=` query parameter (server-side). */
export function isReportingPeriod(value: unknown): value is ReportingPeriod {
  const candidate = typeof value === "string" ? Number(value) : value;
  return candidate === 7 || candidate === 30 || candidate === 90;
}

/**
 * The trailing-N-day reporting window ending at `now`. `from` is exactly
 * `period` days before `to`, so consecutive windows never overlap and a
 * 7/30/90 selection always spans a full, equal-length period.
 */
export function reportingRangeForDays(
  period: ReportingPeriod,
  now: Date = new Date()
): DashboardRange {
  return {
    from: new Date(now.getTime() - period * 24 * 60 * 60 * 1000),
    to: now,
  };
}

/**
 * The equal-length period immediately preceding `range`.
 *
 * `range` is `[from, to]` (inclusive, matching the repository's
 * `captured_at BETWEEN` semantics). The previous period therefore ends
 * just before `from` — at `from - 1ms`, so the two windows partition the
 * timeline without overlap or gap. Its length is exactly `to - from`,
 * so a trailing-N-day selection yields the preceding N days.
 */
export function previousPeriod(range: DashboardRange): DashboardRange {
  const periodMs = range.to.getTime() - range.from.getTime();
  const previousTo = new Date(range.from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - periodMs);
  return { from: previousFrom, to: previousTo };
}

/**
 * Percentage change of `current` relative to `previous`, in percent
 * (e.g. 12.5 for "+12.5%").
 *
 * Returns `null` — never `Infinity`, `NaN`, or a number — when the
 * comparison is unavailable or untrustworthy:
 *   - `previous` is `undefined`/`null` (no earlier reading exists)
 *   - `previous` is `0` (zero-denominator; the change is unbounded)
 *   - either value is not finite
 *
 * Pure and synchronous. Callers decide what `null` means for display
 * (e.g. an N/A "—").
 */
export function percentageChange(
  current: number,
  previous: number | null | undefined
): number | null {
  if (previous === null || previous === undefined) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}