import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_REPORTING_PERIOD,
  REPORTING_PERIODS,
  isReportingPeriod,
  percentageChange,
  previousPeriod,
  reportingRangeForDays,
  type DashboardRange,
} from "@/lib/dashboard-period";

const NOW = new Date("2026-08-15T12:00:00.000Z");

test("reportingRangeForDays: 7-day period spans the trailing 7 days", () => {
  const range = reportingRangeForDays(7, NOW);
  assert.equal(range.to, NOW);
  assert.equal(
    range.from.toISOString(),
    new Date("2026-08-08T12:00:00.000Z").toISOString()
  );
});

test("reportingRangeForDays: 30-day period spans the trailing 30 days", () => {
  const range = reportingRangeForDays(30, NOW);
  assert.equal(
    range.from.toISOString(),
    new Date("2026-07-16T12:00:00.000Z").toISOString()
  );
});

test("reportingRangeForDays: 90-day period spans the trailing 90 days", () => {
  const range = reportingRangeForDays(90, NOW);
  assert.equal(
    range.from.toISOString(),
    new Date("2026-05-17T12:00:00.000Z").toISOString()
  );
});

test("previousPeriod: 7-day period yields the exact preceding 7 days", () => {
  const range = reportingRangeForDays(7, NOW);
  const previous = previousPeriod(range);

  // [Aug 1 .. Aug 7 23:59:59.999] — ends 1ms before the current period's start.
  assert.equal(
    previous.to.toISOString(),
    new Date("2026-08-08T11:59:59.999Z").toISOString()
  );
  assert.equal(
    previous.from.toISOString(),
    new Date("2026-08-01T11:59:59.999Z").toISOString()
  );
  // Equal length, no overlap with the current period.
  assert.equal(
    previous.to.getTime() - previous.from.getTime(),
    range.to.getTime() - range.from.getTime()
  );
});

test("previousPeriod: 30-day period yields the exact preceding 30 days", () => {
  const range = reportingRangeForDays(30, NOW);
  const previous = previousPeriod(range);
  assert.equal(
    previous.to.toISOString(),
    new Date("2026-07-16T11:59:59.999Z").toISOString()
  );
  assert.equal(
    previous.from.toISOString(),
    new Date("2026-06-16T11:59:59.999Z").toISOString()
  );
});

test("previousPeriod: 90-day period yields the exact preceding 90 days", () => {
  const range = reportingRangeForDays(90, NOW);
  const previous = previousPeriod(range);
  assert.equal(
    previous.to.toISOString(),
    new Date("2026-05-17T11:59:59.999Z").toISOString()
  );
  assert.equal(
    previous.from.toISOString(),
    new Date("2026-02-16T11:59:59.999Z").toISOString()
  );
});

test("previousPeriod: arbitrary range produces an equal-length adjacent window", () => {
  const range: DashboardRange = {
    from: new Date("2026-01-10T00:00:00.000Z"),
    to: new Date("2026-01-20T00:00:00.000Z"),
  };
  const previous = previousPeriod(range);
  assert.equal(
    previous.to.toISOString(),
    new Date("2026-01-09T23:59:59.999Z").toISOString()
  );
  assert.equal(
    previous.from.toISOString(),
    new Date("2025-12-30T23:59:59.999Z").toISOString()
  );
  assert.equal(
    previous.to.getTime() - previous.from.getTime(),
    range.to.getTime() - range.from.getTime()
  );
});

test("percentageChange: normal positive change", () => {
  assert.equal(percentageChange(120, 100), 20);
});

test("percentageChange: negative change", () => {
  assert.equal(percentageChange(80, 100), -20);
});

test("percentageChange: no change", () => {
  assert.equal(percentageChange(100, 100), 0);
});

test("percentageChange: previous is 0 returns null (no Infinity/NaN)", () => {
  assert.equal(percentageChange(100, 0), null);
  assert.equal(percentageChange(0, 0), null);
});

test("percentageChange: missing previous value returns null", () => {
  assert.equal(percentageChange(100, undefined), null);
  assert.equal(percentageChange(100, null), null);
});

test("percentageChange: non-finite inputs return null", () => {
  assert.equal(percentageChange(Infinity, 100), null);
  assert.equal(percentageChange(NaN, 100), null);
  assert.equal(percentageChange(100, Infinity), null);
  assert.equal(percentageChange(100, NaN), null);
});

test("percentageChange: fractional change is preserved", () => {
  const change = percentageChange(1.5, 2);
  assert.ok(change !== null);
  assert.ok(Math.abs(change - (-25)) < 1e-9);
});

test("isReportingPeriod: accepts only 7/30/90, string or number", () => {
  assert.equal(isReportingPeriod(7), true);
  assert.equal(isReportingPeriod("30"), true);
  assert.equal(isReportingPeriod("90"), true);
  assert.equal(isReportingPeriod(14), false);
  assert.equal(isReportingPeriod("7d"), false);
  assert.equal(isReportingPeriod(undefined), false);
  assert.equal(isReportingPeriod(""), false);
});

test("REPORTING_PERIODS and DEFAULT_REPORTING_PERIOD are the whitelist contract", () => {
  assert.deepEqual(REPORTING_PERIODS, [7, 30, 90]);
  assert.equal(DEFAULT_REPORTING_PERIOD, 30);
});