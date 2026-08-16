import { test } from "node:test";
import assert from "node:assert/strict";
import { isCollectionDue, normalizeCollectionFrequency } from "@repo/shared";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function hoursAfter(lastRunAt: Date, hours: number): Date {
  return new Date(lastRunAt.getTime() + hours * HOUR_MS);
}

// --- Test 9: no previous run is always due -----------------------------

test("collection due: a unit with no previous run is always due", () => {
  const now = new Date("2026-08-15T12:00:00.000Z");
  assert.equal(isCollectionDue({ collectionFrequency: 1, lastRunAt: null, now }), true);
  assert.equal(
    isCollectionDue({ collectionFrequency: 12, lastRunAt: null, now }),
    true
  );
});

// --- Test 10: frequency 1 waits a full day -----------------------------

test("collection due: frequency 1 is not due at 23 hours", () => {
  const lastRunAt = new Date("2026-08-14T00:00:00.000Z");
  const now = hoursAfter(lastRunAt, 23);
  assert.equal(isCollectionDue({ collectionFrequency: 1, lastRunAt, now }), false);
});

// --- Test 11: exact boundary is due (freq 1 at exactly 24h) ------------

test("collection due: frequency 1 is due at exactly 24 hours", () => {
  const lastRunAt = new Date("2026-08-14T00:00:00.000Z");
  const now = new Date(lastRunAt.getTime() + DAY_MS);
  assert.equal(isCollectionDue({ collectionFrequency: 1, lastRunAt, now }), true);
});

// --- Test 12: frequency 4 runs every 6 hours ---------------------------

test("collection due: frequency 4 is due at 6 hours", () => {
  const lastRunAt = new Date("2026-08-14T00:00:00.000Z");
  const now = hoursAfter(lastRunAt, 6);
  assert.equal(isCollectionDue({ collectionFrequency: 4, lastRunAt, now }), true);
});

test("collection due: frequency 4 is not due at 5h59m59s", () => {
  const lastRunAt = new Date("2026-08-14T00:00:00.000Z");
  const now = new Date(lastRunAt.getTime() + 6 * HOUR_MS - 1000);
  assert.equal(isCollectionDue({ collectionFrequency: 4, lastRunAt, now }), false);
});

// --- Test 13: frequency 12 runs every 2 hours --------------------------

test("collection due: frequency 12 is due at 2 hours", () => {
  const lastRunAt = new Date("2026-08-14T00:00:00.000Z");
  const now = hoursAfter(lastRunAt, 2);
  assert.equal(isCollectionDue({ collectionFrequency: 12, lastRunAt, now }), true);
});

// --- Test 14: long overdue is always due -------------------------------

test("collection due: a long-overdue unit is due", () => {
  const lastRunAt = new Date("2026-08-11T00:00:00.000Z");
  const now = new Date("2026-08-15T00:00:00.000Z");
  assert.equal(isCollectionDue({ collectionFrequency: 1, lastRunAt, now }), true);
});

// --- Test 15: exact boundary ± 1ms is deterministic --------------------

test("collection due: exact boundary is deterministic to the millisecond", () => {
  const lastRunAt = new Date("2026-08-14T00:00:00.000Z");

  const oneMsBefore = new Date(lastRunAt.getTime() + DAY_MS - 1);
  assert.equal(isCollectionDue({ collectionFrequency: 1, lastRunAt, now: oneMsBefore }), false);

  const exactly = new Date(lastRunAt.getTime() + DAY_MS);
  assert.equal(isCollectionDue({ collectionFrequency: 1, lastRunAt, now: exactly }), true);
});

// --- Test 16: invalid / non-positive frequency falls back to default ---

test("collection due: non-positive or invalid frequency falls back to 1/day", () => {
  const lastRunAt = new Date("2026-08-14T00:00:00.000Z");

  assert.equal(normalizeCollectionFrequency(0), 1);
  assert.equal(normalizeCollectionFrequency(-4), 1);
  assert.equal(normalizeCollectionFrequency(1.5), 1);
  assert.equal(normalizeCollectionFrequency(null), 1);
  assert.equal(normalizeCollectionFrequency(undefined), 1);

  const nowAtOneDay = new Date(lastRunAt.getTime() + DAY_MS);
  assert.equal(
    isCollectionDue({ collectionFrequency: 0, lastRunAt, now: nowAtOneDay }),
    true
  );
  assert.equal(
    isCollectionDue({ collectionFrequency: -1, lastRunAt, now: nowAtOneDay }),
    true
  );

  const nowBeforeOneDay = hoursAfter(lastRunAt, 23);
  assert.equal(
    isCollectionDue({ collectionFrequency: 0, lastRunAt, now: nowBeforeOneDay }),
    false
  );
});