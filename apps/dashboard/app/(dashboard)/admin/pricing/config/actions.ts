"use server";

import { revalidatePath } from "next/cache";
import type { PricingMetric } from "@repo/shared";
import { getCurrentUser } from "@/lib/get-current-user";
import { canViewPricing, runCreatePricingRule } from "@/lib/pricing-admin";
import { requireClientAccess } from "@/lib/access";
import { getDatabase } from "@/lib/db";

export type CreatePricingRuleInput = {
  clientId: string;
  metric: PricingMetric;
  percentageMarkup: number | null;
  fixedMarkup: number | null;
  minimumCustomerValue: number | null;
  /** ISO date the rule becomes effective (effectiveFrom). */
  effectiveFrom: string;
};

export type CreatePricingRuleResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Inserts a NEW effective-dated pricing rule for a client+metric. This is
 * strictly append-only: historical rules are never updated or deleted, and
 * raw Meta values are never touched. A past effectiveFrom becomes
 * applicable immediately; a future one is scheduled and does not replace
 * the current rule until its date.
 *
 * Authorization is enforced server-side: only the Super Admin can reach
 * this action (canViewPricing throws for other roles). Hiding the button
 * in the UI is a convenience, never the security boundary.
 */
export async function createPricingRule(
  input: CreatePricingRuleInput
): Promise<CreatePricingRuleResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "ابتدا وارد شوید." };
  }
  if (!canViewPricing(user)) {
    return {
      ok: false,
      error: "فقط مدیر کل می‌تواند قیمت‌گذاری را تنظیم کند.",
    };
  }

  // The clientId arrives from the client component as action input; it
  // passes through the central tenant-access boundary. For the super
  // admin this is unrestricted; the gate keeps the rule in one place.
  await requireClientAccess(user, input.clientId);

  const outcome = await runCreatePricingRule(
    user,
    {
      clientId: input.clientId,
      metric: input.metric,
      percentageMarkup: input.percentageMarkup,
      fixedMarkup: input.fixedMarkup,
      minimumCustomerValue: input.minimumCustomerValue,
      effectiveFrom: new Date(input.effectiveFrom),
    },
    getDatabase()
  );
  if (!outcome.ok) {
    return { ok: false, error: outcome.error };
  }

  revalidatePath("/dashboard/admin/pricing/config");
  revalidatePath("/dashboard/admin/pricing");
  return { ok: true };
}