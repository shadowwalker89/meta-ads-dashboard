/**
 * Canonical representation of a reporting-window calendar date, as
 * supplied by Meta's CSV export (format CONFIRMED from a real
 * production export: `YYYY-MM-DD`).
 *
 * Conventions:
 *  - at rest (SQLite) it is stored as the canonical `YYYY-MM-DD` TEXT,
 *    exactly as Meta provided it — never a fabricated value;
 *  - in memory it is a `Date` at UTC midnight of that calendar day, so
 *    the same calendar date reads back identically regardless of the
 *    server timezone;
 *  - a missing bound is `null` — never inferred, never a substitute for
 *    `capturedAt`.
 *
 * Values that do not match the confirmed format are treated as errors
 * (thrown), not guessed at or silently re-interpreted.
 */

const REPORTING_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a confirmed `YYYY-MM-DD` reporting date into a UTC-midnight
 * `Date`. `null`/`undefined`/empty stay `null`. A non-null value that
 * is not a real `YYYY-MM-DD` calendar date throws instead of guessing.
 */
export function parseReportingDate(value: string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;

  const match = REPORTING_DATE_PATTERN.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid reporting date "${value}" — expected YYYY-MM-DD`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  // Reject impossible calendar dates ("2025-13-01", "2026-02-30") that
  // the pattern alone would accept.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid reporting date "${value}" — not a real calendar date`);
  }

  return date;
}

/**
 * Serializes a reporting `Date` back to the canonical `YYYY-MM-DD`
 * form, in UTC. `null`/`undefined` stay `null`.
 */
export function formatReportingDate(date: Date | null | undefined): string | null {
  if (date === null || date === undefined) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}