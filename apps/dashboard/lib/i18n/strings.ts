import type { DashboardKpiKey } from "@repo/shared";
import { KPI_CATALOG_BY_KEY } from "@repo/shared";
import type { ReportingPeriod } from "@/lib/dashboard-period";

/**
 * Dashboard language identifiers. `fa` (Persian) is the product default
 * and keeps the existing RTL/Vazirmatn presentation; `en` switches the
 * dashboard group to LTR/Geist.
 *
 * This module is the single source of truth for every user-visible
 * string on the dashboard group. No hardcoded copy lives inside the
 * components; server components pick the dictionary by `lang` prop,
 * client components read it from the LanguageProvider context.
 */
export type AppLanguage = "fa" | "en";

export const DEFAULT_LANGUAGE: AppLanguage = "fa";

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === "fa" || value === "en";
}

/**
 * The cookie that stores the dashboard language. Lives here (not in the
 * server-only module) so both the server resolver and the client
 * LanguageProvider can reference the same name/constants. This module
 * deliberately imports nothing from `next/*` — it stays client-safe.
 */
export const LANG_COOKIE = "dashboard-lang";
export const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** BCP-47 locale used for number/date formatting per language. */
export function localeForLanguage(lang: AppLanguage): "fa-IR" | "en-US" {
  return lang === "en" ? "en-US" : "fa-IR";
}

/**
 * Fills `{key}` placeholders in a template string. Missing params are
 * left as-is so a forgotten key is visible instead of silently blank.
 */
export function tpl(
  template: string,
  params: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

export interface DashboardStrings {
  // Shared chrome (topbar / sidebar / mobile nav)
  brandTitle: string;
  brandTagline: string;
  sidebarToggleCollapse: string;
  sidebarToggleExpand: string;
  navDashboard: string;
  navKpiConfig: string;
  navClients: string;
  navPackages: string;
  navAssignPackage: string;
  navPricingReview: string;
  navPricingConfig: string;
  welcome: string;
  signOut: string;
  languageLabel: string;

  // Dashboard page / hero
  dashboardTitle: string;
  dashboardSubtitle: string;
  /** Filled with {from} / {to} formatted dates. */
  rangeFromTo: string;
  lastUpdate: string;
  reportingRangeLabel: string;
  errorLoadingData: string;
  noClientAccount: string;
  noKpisActive: string;
  noKpisActiveHint: string;
  noDataRecorded: string;
  noDataRecordedHint: string;

  // Campaign performance table
  campaignTableTitle: string;
  /** Filled with {period} (locale-formatted number of days). */
  campaignTableDescription: string;
  tableCampaignName: string;
  tableAdAccount: string;
  tableCapturedAt: string;
  tableEmpty: string;

  // Campaign comparison chart
  chartTitle: string;
  /** Filled with {period} (e.g. "۷" or "30"). */
  chartDescription: string;
  /** Filled with {metric} (the selected metric label). */
  chartTotalLabel: string;
  chartMetricAria: string;
  chartNoMetric: string;
  chartNoData: string;
  /** Filled with {metric}. */
  chartBarsAriaLabel: string;

  // Data export button
  exportIdle: string;
  exportLoading: string;
  exportSuccess: string;
  exportError: string;

  // Reporting period selector
  periodAriaLabel: string;
  period7Days: string;
  period30Days: string;
  period90Days: string;

  // KPI trend label
  trendVsPrevious: string;

  // Advanced reporting placeholder surface
  advancedTitle: string;
  advancedDescription: string;
  advancedEmpty: string;
}

export const DASHBOARD_STRINGS: Record<AppLanguage, DashboardStrings> = {
  fa: {
    brandTitle: "پنل متا ادز",
    brandTagline: "گزارش کمپین‌ها",
    sidebarToggleCollapse: "بستن منو",
    sidebarToggleExpand: "باز کردن منو",
    navDashboard: "داشبورد",
    navKpiConfig: "تنظیم KPI مشتریان",
    navClients: "مدیریت مشتریان",
    navPackages: "مدیریت پکیج‌ها",
    navAssignPackage: "اختصاص پکیج",
    navPricingReview: "بررسی قیمت‌گذاری",
    navPricingConfig: "تنظیم قیمت‌گذاری",
    welcome: "خوش آمدید،",
    signOut: "خروج",
    languageLabel: "زبان",

    dashboardTitle: "داشبورد",
    dashboardSubtitle: "نمای کلی عملکرد کمپین‌های تبلیغاتی",
    rangeFromTo: "از {from} تا {to}",
    lastUpdate: "آخرین به‌روزرسانی:",
    reportingRangeLabel: "بازه‌ی گزارش‌گیری",
    errorLoadingData: "خطا در بارگذاری داده‌ها. دوباره تلاش کنید.",
    noClientAccount: "برای مشاهده‌ی شاخص‌ها، وارد حساب مشتری شوید.",
    noKpisActive: "هیچ شاخصی برای این مشتری فعال نیست.",
    noKpisActiveHint: "ادمین باید حداقل یک شاخص را برای این مشتری فعال کند.",
    noDataRecorded: "هنوز داده‌ای برای این بازه ثبت نشده است.",
    noDataRecordedHint:
      "به‌محض جمع‌آوری اولین داده، شاخص‌ها در این‌جا نمایش داده می‌شوند.",

    campaignTableTitle: "عملکرد کمپین‌ها",
    campaignTableDescription:
      "جزئیات عملکرد هر کمپین بر اساس آخرین داده‌ی جمع‌آوری‌شده در {period} روز اخیر",
    tableCampaignName: "نام کمپین",
    tableAdAccount: "اکانت تبلیغاتی",
    tableCapturedAt: "زمان جمع‌آوری",
    tableEmpty: "هنوز داده‌ای برای کمپین‌ها ثبت نشده است.",

    chartTitle: "مقایسه‌ی کمپین‌ها",
    chartDescription:
      "ارزش‌های دوره‌ی جاری بر اساس آخرین داده‌ی جمع‌آوری‌شده در {period} اخیر — مقادیر تجمعی دوره، نه فعالیت روزانه.",
    chartTotalLabel: "جمع {metric}",
    chartMetricAria: "معیار نمودار",
    chartNoMetric: "هیچ معیار نموداری برای این مشتری فعال نیست.",
    chartNoData: "هنوز داده‌ای برای این بازه ثبت نشده است.",
    chartBarsAriaLabel: "مقایسه‌ی کمپین‌ها — {metric}",

    exportIdle: "خروجی داده",
    exportLoading: "در حال تهیه‌ی خروجی…",
    exportSuccess: "خروجی با موفقیت دانلود شد.",
    exportError: "تهیه‌ی خروجی ناموفق بود؛ دوباره تلاش کنید.",

    periodAriaLabel: "بازه‌ی گزارش‌گیری",
    period7Days: "۷ روز",
    period30Days: "۳۰ روز",
    period90Days: "۹۰ روز",

    trendVsPrevious: "نسبت به دوره قبل",

    advancedTitle: "گزارش پیشرفته",
    advancedDescription: "گزارش‌های تحلیلی فراتر از شاخص‌های اصلی",
    advancedEmpty: "گزارش پیشرفته به‌زودی در این بخش ارائه می‌شود.",
  },
  en: {
    brandTitle: "Meta Ads Panel",
    brandTagline: "Campaign Reporting",
    sidebarToggleCollapse: "Collapse menu",
    sidebarToggleExpand: "Expand menu",
    navDashboard: "Dashboard",
    navKpiConfig: "Client KPI Setup",
    navClients: "Clients",
    navPackages: "Packages",
    navAssignPackage: "Assign Package",
    navPricingReview: "Pricing Review",
    navPricingConfig: "Pricing Settings",
    welcome: "Welcome,",
    signOut: "Sign out",
    languageLabel: "Language",

    dashboardTitle: "Dashboard",
    dashboardSubtitle: "Overview of ad campaign performance",
    rangeFromTo: "From {from} to {to}",
    lastUpdate: "Last updated:",
    reportingRangeLabel: "Reporting period",
    errorLoadingData: "Failed to load data. Please try again.",
    noClientAccount: "Sign in to a client account to view metrics.",
    noKpisActive: "No KPIs are enabled for this client.",
    noKpisActiveHint: "An admin must enable at least one KPI for this client.",
    noDataRecorded: "No data recorded for this period yet.",
    noDataRecordedHint:
      "As soon as the first data is collected, KPIs will appear here.",

    campaignTableTitle: "Campaign Performance",
    campaignTableDescription:
      "Performance details per campaign based on the latest collected data in the last {period} days",
    tableCampaignName: "Campaign",
    tableAdAccount: "Ad account",
    tableCapturedAt: "Collected at",
    tableEmpty: "No campaign data recorded yet.",

    chartTitle: "Campaign Comparison",
    chartDescription:
      "Current-period values based on the latest collected data over the last {period} days — cumulative period values, not daily activity.",
    chartTotalLabel: "Total {metric}",
    chartMetricAria: "Chart metric",
    chartNoMetric: "No chart metric is enabled for this client.",
    chartNoData: "No data recorded for this period yet.",
    chartBarsAriaLabel: "Campaign comparison — {metric}",

    exportIdle: "Export data",
    exportLoading: "Preparing export…",
    exportSuccess: "Export downloaded successfully.",
    exportError: "Failed to prepare the export; please try again.",

    periodAriaLabel: "Reporting period",
    period7Days: "7 days",
    period30Days: "30 days",
    period90Days: "90 days",

    trendVsPrevious: "vs previous period",

    advancedTitle: "Advanced Reporting",
    advancedDescription: "Analytical reports beyond the core metrics",
    advancedEmpty: "Advanced reporting will be available here soon.",
  },
};

/** The reporting-period label (7/30/90) for the current language. */
export function periodLabel(
  period: ReportingPeriod,
  lang: AppLanguage
): string {
  return DASHBOARD_STRINGS[lang][`period${period}Days`];
}

/**
 * English labels for every KPI in the shared catalog. The shared catalog
 * is deliberately Persian-first (the product's default language); this
 * dashboard-layer map is the only place that localizes KPI copy.
 */
export const KPI_LABELS_EN: Record<DashboardKpiKey, string> = {
  spend: "Ad Spend",
  impressions: "Impressions",
  reach: "Reach",
  frequency: "Frequency",
  clicks: "Clicks",
  clicksAll: "Clicks (All)",
  linkClicks: "Link Clicks",
  uniqueClicks: "Unique Clicks",
  ctr: "Click-Through Rate (CTR)",
  uniqueCtr: "Unique CTR",
  cpc: "Cost per Click (CPC)",
  cpm: "Cost per 1K Impressions (CPM)",
  landingPageViews: "Landing Page Views",
  outboundClicks: "Outbound Clicks",
  outboundCtr: "Outbound CTR",
  leads: "Leads",
  messagesStarted: "Messages Started",
  messagesContacts: "Messenger Contacts",
  results: "Results",
  costPerResult: "Cost per Result",
  postReactions: "Reactions",
  postComments: "Comments",
};

export const KPI_DESCRIPTIONS_EN: Record<DashboardKpiKey, string> = {
  spend: "Total spend for the period",
  impressions: "Total impressions",
  reach: "Number of people who saw the ad",
  frequency: "Average times shown per person",
  clicks: "Number of clicks on the link",
  clicksAll: "Total clicks on the ad",
  linkClicks: "Clicks on the destination link",
  uniqueClicks: "Number of unique users who clicked",
  ctr: "Clicks relative to impressions",
  uniqueCtr: "Unique clicks relative to impressions",
  cpc: "Average cost per click",
  cpm: "Average cost per 1,000 impressions",
  landingPageViews: "Number of views of the destination page",
  outboundClicks: "Clicks that leave the ad",
  outboundCtr: "Outbound clicks relative to impressions",
  leads: "Number of recorded leads",
  messagesStarted: "Number of conversations started in Messenger",
  messagesContacts: "Number of Messenger conversations",
  results: "Total results",
  costPerResult: "Average cost per result",
  postReactions: "Number of reactions to posts",
  postComments: "Number of comments on posts",
};

/**
 * Catalog label for a KPI in the requested language. Falls back to the
 * key itself for unknown keys (never crashes).
 */
export function getKpiLabel(key: DashboardKpiKey, lang: AppLanguage): string {
  if (lang === "en") return KPI_LABELS_EN[key];
  return KPI_CATALOG_BY_KEY.get(key)?.label ?? key;
}

/**
 * Catalog description for a KPI in the requested language. Falls back to
 * the catalog's Persian description (or the key) for unknown keys.
 */
export function getKpiDescription(
  key: DashboardKpiKey,
  lang: AppLanguage
): string {
  if (lang === "en") return KPI_DESCRIPTIONS_EN[key];
  return KPI_CATALOG_BY_KEY.get(key)?.description ?? key;
}
