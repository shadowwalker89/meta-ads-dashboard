/**
 * Package resource-limit helpers — the enforcement FOUNDATION.
 *
 * Package settings are the single source of truth for limits
 * (Package.maxAdAccounts / Package.maxCampaigns). These helpers are
 * pure and storage-agnostic: the server-side enforcement service
 * (SqlitePackageEnforcement in @repo/database) feeds them current
 * counts and the package settings, never a package code string.
 *
 * Limit convention (kept consistent with the Package Foundation):
 *   - null            => unlimited
 *   - non-positive (0, negative) or non-integer => treated as no limit
 *     configured (conservative, non-breaking), matching the foundation's
 *     "null = unlimited" convention
 *   - a positive integer => a real, enforced limit
 */

/**
 * Normalizes a stored limit value to the only form that is actually
 * enforced: a positive integer. Everything else becomes null
 * (unlimited). This is deliberate: a misconfigured 0 or negative value
 * must never accidentally block all creation, and must never be read as
 * "zero allowed".
 */
export function normalizeResourceLimit(
  max: number | null | undefined
): number | null {
  if (typeof max !== "number" || !Number.isInteger(max) || max <= 0) {
    return null;
  }
  return max;
}

/**
 * True when currentCount has reached the enforced limit. Unlimited
 * (null after normalization) never reports "at limit", so an unlimited
 * package can create as many resources as the data model allows.
 */
export function isAtResourceLimit(
  currentCount: number,
  max: number | null | undefined
): boolean {
  const limit = normalizeResourceLimit(max);
  return limit !== null && currentCount >= limit;
}