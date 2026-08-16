import type { User } from "./entities";

/**
 * Stable, typed identifiers for every KPI the product understands.
 * Both the Admin KPI configuration UI and the Client Dashboard read
 * from this single catalog — there are no ad-hoc KPI string literals
 * anywhere else in the app.
 */
export type DashboardKpiKey =
  | "spend"
  | "impressions"
  | "reach"
  | "frequency"
  | "clicks"
  | "clicksAll"
  | "linkClicks"
  | "uniqueClicks"
  | "ctr"
  | "uniqueCtr"
  | "cpc"
  | "cpm"
  | "landingPageViews"
  | "outboundClicks"
  | "outboundCtr"
  | "leads"
  | "messagesStarted"
  | "messagesContacts"
  | "results"
  | "costPerResult"
  | "postReactions"
  | "postComments";

export type KpiFormat =
  | "currency"
  | "currencyCents"
  | "percentage"
  | "ratio"
  | "integer";

export type KpiGroup =
  | "performance"
  | "traffic"
  | "conversions"
  | "messaging"
  | "engagement"
  | "cost";

export interface KpiDefinition {
  key: DashboardKpiKey;
  label: string;
  description: string;
  group: KpiGroup;
  format: KpiFormat;
}

export interface KpiGroupDefinition {
  key: KpiGroup;
  label: string;
}

export const KPI_GROUPS: readonly KpiGroupDefinition[] = [
  { key: "performance", label: "عملکرد" },
  { key: "traffic", label: "ترافیک" },
  { key: "conversions", label: "تبدیل" },
  { key: "messaging", label: "پیام‌رسانی" },
  { key: "engagement", label: "تعامل" },
  { key: "cost", label: "هزینه" },
];

export const KPI_CATALOG: readonly KpiDefinition[] = [
  // Performance
  {
    key: "impressions",
    label: "نمایش‌ها",
    description: "تعداد کل نمایش‌ها",
    group: "performance",
    format: "integer",
  },
  {
    key: "reach",
    label: "دسترسی",
    description: "تعداد افرادی که تبلیغ را دیده‌اند",
    group: "performance",
    format: "integer",
  },
  {
    key: "frequency",
    label: "فرکانس",
    description: "میانگین دفعات نمایش برای هر نفر",
    group: "performance",
    format: "ratio",
  },
  {
    key: "clicks",
    label: "کلیک‌ها",
    description: "تعداد کلیک روی لینک",
    group: "performance",
    format: "integer",
  },
  {
    key: "clicksAll",
    label: "کلیک‌ها (همه)",
    description: "تعداد کل کلیک‌ها روی تبلیغ",
    group: "performance",
    format: "integer",
  },
  {
    key: "linkClicks",
    label: "کلیک روی لینک",
    description: "کلیک‌های روی لینک مقصد",
    group: "performance",
    format: "integer",
  },
  {
    key: "uniqueClicks",
    label: "کلیک‌های یکتا",
    description: "تعداد کاربران یکتایی که کلیک کرده‌اند",
    group: "performance",
    format: "integer",
  },
  {
    key: "ctr",
    label: "نرخ کلیک (CTR)",
    description: "نسبت کلیک به نمایش",
    group: "performance",
    format: "percentage",
  },
  {
    key: "uniqueCtr",
    label: "نرخ کلیک یکتا (Unique CTR)",
    description: "نسبت کلیک‌های یکتا به نمایش",
    group: "performance",
    format: "percentage",
  },

  // Traffic
  {
    key: "landingPageViews",
    label: "بازدید از صفحه فرود",
    description: "تعداد بازدید از صفحه مقصد",
    group: "traffic",
    format: "integer",
  },
  {
    key: "outboundClicks",
    label: "کلیک‌های خروجی",
    description: "کلیک‌هایی که از تبلیغ خارج می‌شوند",
    group: "traffic",
    format: "integer",
  },
  {
    key: "outboundCtr",
    label: "نرخ کلیک خروجی",
    description: "نسبت کلیک‌های خروجی به نمایش",
    group: "traffic",
    format: "percentage",
  },

  // Conversions
  {
    key: "leads",
    label: "لیدها",
    description: "تعداد لیدهای ثبت‌شده",
    group: "conversions",
    format: "integer",
  },
  {
    key: "results",
    label: "نتایج",
    description: "تعداد کل نتایج",
    group: "conversions",
    format: "integer",
  },
  {
    key: "costPerResult",
    label: "هزینه به ازای نتیجه",
    description: "میانگین هزینه هر نتیجه",
    group: "conversions",
    format: "currencyCents",
  },

  // Messaging
  {
    key: "messagesStarted",
    label: "پیام‌های شروع‌شده",
    description: "تعداد گفتگوهای شروع‌شده در پیام‌رسان",
    group: "messaging",
    format: "integer",
  },
  {
    key: "messagesContacts",
    label: "تماس‌های پیام‌رسان",
    description: "تعداد گفتگوهای پیام‌رسان",
    group: "messaging",
    format: "integer",
  },

  // Engagement
  {
    key: "postReactions",
    label: "واکنش‌ها",
    description: "تعداد واکنش‌ها به پست‌ها",
    group: "engagement",
    format: "integer",
  },
  {
    key: "postComments",
    label: "نظرات",
    description: "تعداد نظرات پست‌ها",
    group: "engagement",
    format: "integer",
  },

  // Cost
  {
    key: "spend",
    label: "هزینه تبلیغات",
    description: "کل هزینه‌ی دوره",
    group: "cost",
    format: "currency",
  },
  {
    key: "cpc",
    label: "هزینه به ازای کلیک (CPC)",
    description: "میانگین هزینه‌ی هر کلیک",
    group: "cost",
    format: "currencyCents",
  },
  {
    key: "cpm",
    label: "هزینه به ازای هزار نمایش (CPM)",
    description: "میانگین هزینه‌ی هر هزار نمایش",
    group: "cost",
    format: "currencyCents",
  },
];

export const KPI_CATALOG_BY_KEY: ReadonlyMap<DashboardKpiKey, KpiDefinition> =
  new Map(KPI_CATALOG.map((def) => [def.key, def]));

/**
 * The KPI set shown when a client has no explicit preference yet.
 * Matches what the dashboard displayed before KPI configuration existed,
 * so existing clients see an identical dashboard until an admin changes it.
 */
export const DEFAULT_VISIBLE_KPIS: readonly DashboardKpiKey[] = [
  "spend",
  "impressions",
  "clicks",
  "linkClicks",
  "ctr",
  "cpc",
  "cpm",
];

export function isDashboardKpiKey(value: unknown): value is DashboardKpiKey {
  return typeof value === "string" && KPI_CATALOG_BY_KEY.has(value as DashboardKpiKey);
}

/**
 * Filters a persisted/raw list of keys down to known catalog keys,
 * preserving order and dropping duplicates. Invalid/obsolete keys are
 * safely ignored — never surfaced, never thrown on.
 */
export function sanitizeDashboardKpiKeys(keys: readonly unknown[]): DashboardKpiKey[] {
  const seen = new Set<DashboardKpiKey>();
  const result: DashboardKpiKey[] = [];
  for (const key of keys) {
    if (isDashboardKpiKey(key) && !seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  return result;
}

/**
 * Resolves what a client should see: explicit preference wins, otherwise
 * the package's default KPI set, otherwise the global default set. The
 * preference carries raw keys so this stays safe against
 * corrupt/obsolete persisted values; packageDefault is already
 * sanitized at the repository boundary.
 */
export function resolveVisibleKpis(
  preference: { visibleMetrics: readonly unknown[] } | null,
  packageDefault?: readonly DashboardKpiKey[]
): DashboardKpiKey[] {
  if (preference) {
    const sanitized = sanitizeDashboardKpiKeys(preference.visibleMetrics);
    if (sanitized.length > 0) return sanitized;
  }
  if (packageDefault && packageDefault.length > 0) return [...packageDefault];
  return [...DEFAULT_VISIBLE_KPIS];
}

/**
 * Pure authorization rule shared by the server action and tests:
 * only super_admin may configure any client; a normal admin may only
 * configure clients assigned to them; clients can never configure KPIs.
 */
export function canUserConfigureClientKpis(
  user: Pick<User, "role">,
  clientId: string,
  adminAssignedClientIds: readonly string[]
): boolean {
  if (user.role === "super_admin") return true;
  if (user.role === "admin") return adminAssignedClientIds.includes(clientId);
  return false;
}