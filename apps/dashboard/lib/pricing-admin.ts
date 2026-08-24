import type { PricingMetric, PricingRule, User } from "@repo/shared";
import { PRICABLE_METRICS, selectApplicablePricingRule } from "@repo/shared";
import { sqliteAuditService } from "@/lib/audit";
import { getClientKpis } from "@/lib/client-kpis";
import { getClientPricedKpis, type PricedKpi } from "@/lib/pricing";
import { getDatabase, getRepositories } from "@/lib/db";

/**
 * Server-only. Super Admin verification of the complete pricing
 * pipeline:
 *
 *   Meta Raw → Applicable Pricing Rule → Customer Value
 *
 * Reuses the existing client KPI service (raw values) and the existing
 * pricing service (rule selection + customer value calculation). No
 * pricing logic is re-implemented here.
 */

/**
 * Super Admin verification is restricted to super_admin. Admin and
 * client roles are denied — there is no per-client assignment
 * relaxation for this debugging surface.
 */
export function canViewPricing(user: Pick<User, "role"> | null): boolean {
  return user?.role === "super_admin";
}

export function assertCanViewPricing(user: Pick<User, "role">): void {
  if (!canViewPricing(user)) {
    throw new Error("فقط مدیر کل می‌تواند قیمت‌گذاری را تنظیم کند.");
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "خطای ناشناخته رخ داد.";
}

export type ActionResult<T> = { ok: true; value: T } | { ok: false; error: string };

export interface CreatePricingRuleInput {
  clientId: string;
  metric: PricingMetric;
  percentageMarkup: number | null;
  fixedMarkup: number | null;
  minimumCustomerValue: number | null;
  /** Date the rule becomes effective (effectiveFrom). */
  effectiveFrom: Date;
}

/**
 * The ONLY application entry point for creating a pricing rule. Enforces
 * the super-admin policy, validates the metric/date/client, creates the
 * rule through the existing repository (strictly append-only), and then
 * records an audit entry. Audit runs only after the rule was persisted,
 * so a failed creation never produces a success audit record.
 */
export async function runCreatePricingRule(
  user: Pick<User, "role" | "id">,
  input: CreatePricingRuleInput,
  db: ReturnType<typeof getDatabase> = getDatabase()
): Promise<ActionResult<PricingRule>> {
  try {
    assertCanViewPricing(user);

    if (!PRICABLE_METRICS.includes(input.metric)) {
      throw new Error("متریک انتخاب‌شده قابل قیمت‌گذاری نیست.");
    }
    if (Number.isNaN(input.effectiveFrom.getTime())) {
      throw new Error("تاریخ اعتبار نامعتبر است.");
    }

    const { clientRepository, pricingRuleRepository } = getRepositories(db);
    const client = await clientRepository.findById(input.clientId);
    if (!client) {
      throw new Error("مشتری یافت نشد.");
    }

    const created = await pricingRuleRepository.create({
      clientId: input.clientId,
      metric: input.metric,
      percentageMarkup: input.percentageMarkup,
      fixedMarkup: input.fixedMarkup,
      minimumCustomerValue: input.minimumCustomerValue,
      effectiveFrom: input.effectiveFrom,
    });

    await sqliteAuditService(db).recordPricingRuleCreated(user, created);

    return { ok: true, value: created };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/** All clients, for the super admin's client selector. */
export async function getPricingAdminClients(): Promise<
  { id: string; name: string }[]
> {
  const repo = getRepositories().clientRepository;
  const all = await repo.list({ limit: 1000 });
  return all.items.map((c) => ({ id: c.id, name: c.name }));
}

export interface ClientPricingVerification {
  clientId: string;
  clientName: string;
  priced: PricedKpi[];
}

/**
 * Loads the pricing verification data for one client. Raw values come
 * from the existing client KPI aggregation; the pricing layers come
 * from the existing pricing service. Raw Meta values are never
 * modified — only read and passed through.
 */
export async function getClientPricingVerification(
  clientId: string
): Promise<ClientPricingVerification> {
  const clientRepo = getRepositories().clientRepository;
  const client = await clientRepo.findById(clientId);

  const kpis = await getClientKpis(clientId);
  const { priced } = await getClientPricedKpis(clientId, kpis.values);

  return {
    clientId,
    clientName: client?.name ?? clientId,
    priced,
  };
}

// --- Pricing configuration data -------------------------------------------

export interface PricingMetricConfig {
  metric: PricingMetric;
  /** Raw Meta value — never modified by pricing. */
  rawValue: number;
  /** The rule currently applicable (newest effectiveFrom <= now), if any. */
  currentRule: PricingRule | null;
  /** Customer value for the raw value under the currently applicable rule. */
  currentCustomerValue: number;
  /** Rules whose effectiveFrom is in the future, soonest first. */
  futureRules: PricingRule[];
  /** Past rules that are no longer current, newest first. */
  historicalRules: PricingRule[];
}

export interface ClientPricingConfigData {
  clientId: string;
  clientName: string;
  byMetric: Record<PricingMetric, PricingMetricConfig>;
}

/**
 * Server-only. Loads everything the Super Admin pricing configuration UI
 * needs for one client: the raw Meta value per pricable metric (read from
 * the existing client KPI aggregation, never modified), the currently
 * applicable rule, and the future/historical rules — computed with the
 * shared domain selection logic, never reimplemented here.
 */
export async function getClientPricingConfigData(
  clientId: string,
  at: Date = new Date()
): Promise<ClientPricingConfigData> {
  const clientRepo = getRepositories().clientRepository;
  const client = await clientRepo.findById(clientId);

  const kpis = await getClientKpis(clientId);
  const { byMetric } = await getClientPricedKpis(clientId, kpis.values, at);

  const ruleRepo = getRepositories().pricingRuleRepository;
  const rules = await ruleRepo.findByClient(clientId);

  const metricConfigs = {} as Record<PricingMetric, PricingMetricConfig>;
  const now = at.getTime();

  for (const metric of PRICABLE_METRICS) {
    const metricRules = rules.filter((rule) => rule.metric === metric);
    const currentRule = selectApplicablePricingRule(
      metricRules,
      clientId,
      metric,
      at
    );

    metricConfigs[metric] = {
      metric,
      rawValue: kpis.values[metric] ?? 0,
      currentRule,
      currentCustomerValue: byMetric[metric].customerValue,
      futureRules: metricRules
        .filter((rule) => rule.effectiveFrom.getTime() > now)
        .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime()),
      historicalRules: metricRules
        .filter(
          (rule) =>
            rule.effectiveFrom.getTime() <= now &&
            rule.id !== currentRule?.id
        )
        .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime()),
    };
  }

  return {
    clientId,
    clientName: client?.name ?? clientId,
    byMetric: metricConfigs,
  };
}