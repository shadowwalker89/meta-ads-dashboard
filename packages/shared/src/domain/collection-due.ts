import { DEFAULT_COLLECTION_FREQUENCY } from "./package";

/**
 * Collection due-check FOUNDATION.
 *
 * Package.collectionFrequency is the number of collections per day the
 * package entitles and is package-authoritative (there is deliberately
 * NO per-client frequency override). This pure helper decides, for one
 * collection unit (an ad account, which is how CollectorJob rows are
 * recorded), whether a run is due:
 *
 *   interval between runs = 24h / collectionFrequency
 *
 *   due  <=>  no previous run, OR now - lastRunAt >= interval
 *
 * The helper only derives "due" from (frequency, lastRunAt, now). It
 * does NOT read storage, does NOT skip anything, and knows nothing about
 * tiers — a future scheduler/cron passes the frequency from the client's
 * Package and the last job time from CollectorJobRepository, then skips
 * units that are not due. Seed examples: 1 => ~24h, 4 => ~6h,
 * 12 => ~2h.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface CollectionDueInput {
  /**
   * Package.collectionFrequency (runs per day). Non-positive, missing,
   * or non-integer values follow the conservative Package convention:
   * they fall back to DEFAULT_COLLECTION_FREQUENCY (1 run/day).
   */
  collectionFrequency: number | null | undefined;
  /**
   * Time of the latest collection for the unit, or null when there has
   * never been one (a never-collected unit is always due).
   */
  lastRunAt: Date | null;
  /** Current time — the reference point the decision is relative to. */
  now: Date;
}

/** A positive integer is the only valid frequency; everything else uses
 * the conservative default (1 run/day). */
export function normalizeCollectionFrequency(
  collectionFrequency: number | null | undefined
): number {
  if (
    typeof collectionFrequency === "number" &&
    Number.isInteger(collectionFrequency) &&
    collectionFrequency > 0
  ) {
    return collectionFrequency;
  }
  return DEFAULT_COLLECTION_FREQUENCY;
}

/**
 * Deterministic due check. No previous run is always due. Otherwise due
 * exactly when `now - lastRunAt >= 24h / frequency` (millisecond
 * precision), so the exact boundary — e.g. frequency 1 at exactly 24h —
 * is due, and one millisecond before it is not.
 */
export function isCollectionDue({
  collectionFrequency,
  lastRunAt,
  now,
}: CollectionDueInput): boolean {
  if (lastRunAt === null) return true;

  const frequency = normalizeCollectionFrequency(collectionFrequency);
  const intervalMs = DAY_MS / frequency;
  return now.getTime() - lastRunAt.getTime() >= intervalMs;
}