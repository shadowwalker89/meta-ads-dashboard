import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatReportingDate,
  parseReportingDate,
} from "@repo/shared";

test("reporting date: parses the confirmed YYYY-MM-DD format deterministically", () => {
  assert.equal(
    parseReportingDate("2025-11-28")?.toISOString(),
    "2025-11-28T00:00:00.000Z"
  );
  assert.equal(
    parseReportingDate("2026-08-18")?.toISOString(),
    "2026-08-18T00:00:00.000Z"
  );
});

test("reporting date: format round-trips through the canonical representation", () => {
  assert.equal(formatReportingDate(parseReportingDate("2025-11-28")), "2025-11-28");
  assert.equal(formatReportingDate(parseReportingDate("2026-08-18")), "2026-08-18");
});

test("reporting date: null/undefined/empty stay null, never inferred", () => {
  assert.equal(parseReportingDate(null), null);
  assert.equal(parseReportingDate(undefined), null);
  assert.equal(parseReportingDate(""), null);
  assert.equal(parseReportingDate("   "), null);
  assert.equal(formatReportingDate(null), null);
  assert.equal(formatReportingDate(undefined), null);
});

test("reporting date: non-YYYY-MM-DD values throw instead of being guessed", () => {
  const invalid = [
    "2026-08-18T00:00:00.000Z", // full timestamp — not the confirmed format
    "18/08/2026",
    "08-18-2026",
    "20260818",
    "not-a-date",
    "2025-13-01", // impossible month
    "2026-02-30", // impossible day
    "2026-00-10", // zero month
    "2025-11-32", // zero-padded day overflow
  ];
  for (const value of invalid) {
    assert.throws(
      () => parseReportingDate(value),
      /Invalid reporting date/,
      `expected "${value}" to be rejected`
    );
  }
});

test("reporting date: captured_at can never produce a reporting bound", () => {
  // The only inputs the parser accepts are the confirmed YYYY-MM-DD
  // values — an ISO-8601 captured_at string is rejected, so a fallback
  // from capturedAt is structurally impossible.
  assert.throws(
    () => parseReportingDate("2026-08-18T12:30:00.000Z"),
    /Invalid reporting date/
  );
});