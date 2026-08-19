import type { DashboardKpiKey, KpiGroup } from "@repo/shared";
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
  navAdminOverview: string;
  navKpiConfig: string;
  navClients: string;
  navPackages: string;
  navAssignPackage: string;
  navPricingReview: string;
  navPricingConfig: string;
  welcome: string;
  signOut: string;
  languageLabel: string;

  // Admin overview page
  adminOverviewTitle: string;
  adminOverviewSubtitle: string;
  adminSelectClient: string;
  adminSelectClientPlaceholder: string;
  adminNoClientSelected: string;
  adminNoClientSelectedHint: string;
  adminNoData: string;
  adminSummaryClients: string;
  adminSummaryAdAccounts: string;
  adminSummaryPackages: string;
  adminSummaryCampaigns: string;
  /** Filled with {kpi} (the English KPI title). */
  adminKpiHelp: string;

  // Admin page headers
  adminClientsTitle: string;
  adminClientsSubtitle: string;
  /** Filled with {name} (the client name). */
  adminClientDetailSubtitle: string;
  adminKpiConfigTitle: string;
  adminKpiConfigSubtitle: string;
  adminPackagesTitle: string;
  adminPackagesSubtitle: string;
  adminAssignTitle: string;
  adminAssignSubtitle: string;
  adminPricingTitle: string;
  adminPricingSubtitle: string;
  adminPricingConfigTitle: string;
  adminPricingConfigSubtitle: string;

  // Client management
  clientNew: string;
  clientCreateSaving: string;
  clientCreated: string;
  clientCancel: string;
  clientNameLabel: string;
  clientNamePlaceholder: string;
  clientNameRequired: string;
  clientBusinessLabel: string;
  clientBusinessPlaceholder: string;
  clientEmailLabel: string;
  clientEmailPlaceholder: string;
  clientPackageLabel: string;
  clientActive: string;
  clientInactive: string;
  clientPackageField: string;
  clientAdAccountField: string;
  clientEmailField: string;
  clientManageAccounts: string;
  clientDeactivate: string;
  /** Filled with {name}. */
  clientDeactivateConfirm: string;
  clientEmpty: string;
  clientNoAssigned: string;

  // Ad account management
  adAccountNew: string;
  /** Filled with {package} and {max}. */
  adAccountPackageLimit: string;
  adAccountEmpty: string;
  adAccountMetaIdLabel: string;
  adAccountMetaIdPlaceholder: string;
  adAccountSave: string;
  adAccountSaved: string;
  adAccountStatusLabel: string;
  adAccountStatusUpdated: string;
  adAccountLimitReached: string;
  adAccountNamePlaceholder: string;
  adAccountMetaIdOptional: string;
  adAccountCreate: string;
  adAccountCreated: string;
  statusConnected: string;
  statusPending: string;
  statusError: string;

  // Packages
  packageNew: string;
  packageEdit: string;
  packageEmpty: string;
  pkgNameLabel: string;
  pkgCodeLabel: string;
  pkgCodePlaceholder: string;
  pkgCodeRequired: string;
  pkgDescriptionLabel: string;
  pkgCollectionFrequency: string;
  pkgMaxAdAccounts: string;
  pkgMaxCampaigns: string;
  pkgRetentionDays: string;
  pkgUnlimited: string;
  pkgUnlimitedPlaceholder: string;
  pkgDefaultKpis: string;
  pkgFeatures: string;
  pkgPricingDefaults: string;
  /** Filled with {name} (the package name). */
  pkgEditTitle: string;
  pkgSave: string;
  pkgSaved: string;
  pkgPricingPercentagePlaceholder: string;
  pkgPricingFixedPlaceholder: string;
  pkgPricingMinimumPlaceholder: string;
  /** Filled with {metric} (the English KPI title). */
  pkgPricingPercentageAria: string;
  /** Filled with {metric} (the English KPI title). */
  pkgPricingFixedAria: string;
  /** Filled with {metric} (the English KPI title). */
  pkgPricingMinimumAria: string;
  featureCharts: string;
  featureDataExport: string;
  featureAdvancedReporting: string;

  // Package assignment
  packageCurrent: string;
  packageAssignedAt: string;
  assignSelectClient: string;
  assignSelectPackage: string;
  assignNewPackage: string;
  assignSelectPackagePlaceholder: string;
  assignPreviewTitle: string;
  assignNoPackage: string;
  assignNoClientSelected: string;
  assignButton: string;
  assignButtonBusy: string;
  assignSuccess: string;
  /** Filled with {date} and {count}. */
  assignSuccessChanged: string;
  /** Filled with {count}. */
  assignSuccessUnchanged: string;

  // KPI configuration
  kpiConfigClient: string;
  kpiConfigSave: string;
  kpiConfigSaving: string;
  kpiConfigSaved: string;
  kpiConfigEmpty: string;
  kpiConfigNoAssigned: string;

  // Pricing review / configuration
  pricingMetric: string;
  pricingRawValue: string;
  pricingRule: string;
  pricingCustomerValue: string;
  pricingNoRule: string;
  pricingNoRuleShort: string;
  pricingApplied: string;
  pricingUnchanged: string;
  pricingClientTitle: string;
  /** Filled with {date}. */
  pricingEffectiveFrom: string;
  pricingNewRuleTitle: string;
  pricingPercentage: string;
  pricingPercentagePlaceholder: string;
  pricingFixed: string;
  pricingFixedPlaceholder: string;
  pricingMinimum: string;
  pricingMinimumPlaceholder: string;
  pricingEffectiveDate: string;
  pricingSaveRule: string;
  pricingSaving: string;
  pricingRuleSaved: string;
  pricingComponentsHint: string;
  /** Filled with {kpi}. */
  pricingPreviewTitle: string;
  pricingPreviewNewRule: string;
  pricingPreviewNewValue: string;
  pricingPreviewNote: string;
  /** Filled with {kpi}. */
  pricingHistoryTitle: string;
  pricingRuleCurrent: string;
  pricingRuleScheduled: string;
  pricingRuleHistorical: string;
  pricingRuleCurrentEmpty: string;
  pricingRuleScheduledEmpty: string;
  pricingRuleHistoricalEmpty: string;
  pricingSelectClientPrompt: string;
  pricingConfigSelectClientPrompt: string;

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
    navAdminOverview: "نمای مدیریت",
    navKpiConfig: "تنظیم KPI مشتریان",
    navClients: "مدیریت مشتریان",
    navPackages: "مدیریت پکیج‌ها",
    navAssignPackage: "اختصاص پکیج",
    navPricingReview: "بررسی قیمت‌گذاری",
    navPricingConfig: "تنظیم قیمت‌گذاری",
    welcome: "خوش آمدید،",
    signOut: "خروج",
    languageLabel: "زبان",

    adminOverviewTitle: "نمای مدیریت",
    adminOverviewSubtitle:
      "کنترل و نظارت بر مشتریان، اکانت‌های تبلیغاتی و پکیج‌ها",
    adminSelectClient: "مشتری",
    adminSelectClientPlaceholder: "انتخاب مشتری…",
    adminNoClientSelected:
      "برای مشاهده‌ی شاخص‌های یک مشتری، ابتدا آن را انتخاب کنید.",
    adminNoClientSelectedHint:
      "شاخص‌ها با عنوان انگلیسی KPI و توضیح فارسی نمایش داده می‌شوند.",
    adminNoData: "داده‌ی جمع‌آوری‌شده‌ای برای این مشتری وجود ندارد.",
    adminSummaryClients: "مشتریان",
    adminSummaryAdAccounts: "اکانت تبلیغاتی",
    adminSummaryPackages: "پکیج‌ها",
    adminSummaryCampaigns: "کمپین دارای داده",
    adminKpiHelp: "توضیح درباره‌ی {kpi}",

    adminClientsTitle: "مدیریت مشتریان",
    adminClientsSubtitle:
      "مشتریان، پکیج اختصاص‌داده‌شده و اکانت‌های تبلیغاتی آن‌ها را مدیریت کنید.",
    adminClientDetailSubtitle: "مدیریت اکانت‌های تبلیغاتی {name}.",
    adminKpiConfigTitle: "تنظیم KPI مشتریان",
    adminKpiConfigSubtitle:
      "مشخص کنید هر مشتری کدام شاخص‌ها را در داشبورد خود ببیند.",
    adminPackagesTitle: "مدیریت پکیج‌ها",
    adminPackagesSubtitle:
      "پکیج‌ها داده‌های قابل ویرایش هستند؛ تنظیمات از طریق اعتبارسنجی مشترک ذخیره و پاک‌سازی می‌شوند.",
    adminAssignTitle: "اختصاص پکیج به مشتری",
    adminAssignSubtitle:
      "پس از انتساب، پیش‌فرض‌های قیمت‌گذاری پکیج به‌صورت خودکار به مشتری منتقل می‌شوند.",
    adminPricingTitle: "بررسی قیمت‌گذاری",
    adminPricingSubtitle:
      "مسیر کامل قیمت‌گذاری: ارزش خام متا ← قانون قیمت‌گذاری ← ارزش مشتری",
    adminPricingConfigTitle: "تنظیم قیمت‌گذاری",
    adminPricingConfigSubtitle:
      "برای هر متریک، یک قانون مؤثر جدید تعریف کنید. قوانین فقط اضافه می‌شوند و هرگز تغییر یا حذف نمی‌شوند.",

    clientNew: "مشتری جدید",
    clientCreateSaving: "در حال ذخیره...",
    clientCreated: "مشتری با موفقیت ایجاد شد.",
    clientCancel: "انصراف",
    clientNameLabel: "نام",
    clientNamePlaceholder: "مثلاً فروشگاه آنلاین آریا",
    clientNameRequired: "نام نمی‌تواند خالی باشد.",
    clientBusinessLabel: "نوع کسب‌وکار",
    clientBusinessPlaceholder: "مثلاً فروشگاهی",
    clientEmailLabel: "ایمیل تماس",
    clientEmailPlaceholder: "client@example.com",
    clientPackageLabel: "پکیج",
    clientActive: "فعال",
    clientInactive: "غیرفعال",
    clientPackageField: "پکیج:",
    clientAdAccountField: "اکانت تبلیغاتی:",
    clientEmailField: "ایمیل:",
    clientManageAccounts: "مدیریت اکانت‌ها",
    clientDeactivate: "غیرفعال",
    clientDeactivateConfirm: "مشتری «{name}» غیرفعال شود؟",
    clientEmpty: "هنوز هیچ مشتری‌ای تعریف نشده است.",
    clientNoAssigned: "مشتری‌ای به شما اختصاص داده نشده است.",

    adAccountNew: "اکانت تبلیغاتی جدید",
    adAccountPackageLimit: "پکیج {package}: حداکثر {max} اکانت",
    adAccountEmpty: "این مشتری هنوز هیچ اکانت تبلیغاتی‌ای ندارد.",
    adAccountMetaIdLabel: "شناسه اکانت متا",
    adAccountMetaIdPlaceholder: "مثلاً 2001900877879672",
    adAccountSave: "ذخیره",
    adAccountSaved: "ذخیره شد.",
    adAccountStatusLabel: "وضعیت:",
    adAccountStatusUpdated: "وضعیت به‌روزرسانی شد.",
    adAccountLimitReached:
      "سقف اکانت‌های این مشتری پر شده است؛ ابتدا پکیج را ارتقا دهید.",
    adAccountNamePlaceholder: "مثلاً اکانت اصلی",
    adAccountMetaIdOptional: "شناسه اکانت متا (اختیاری)",
    adAccountCreate: "ایجاد اکانت",
    adAccountCreated: "اکانت با موفقیت ایجاد شد.",
    statusConnected: "متصل",
    statusPending: "در انتظار",
    statusError: "خطا",

    packageNew: "پکیج جدید",
    packageEdit: "ویرایش",
    packageEmpty: "هنوز هیچ پکیجی تعریف نشده است.",
    pkgNameLabel: "نام",
    pkgCodeLabel: "کد پکیج",
    pkgCodePlaceholder: "مثلاً premium",
    pkgCodeRequired: "کد پکیج نمی‌تواند خالی باشد.",
    pkgDescriptionLabel: "توضیحات",
    pkgCollectionFrequency: "دفعات جمع‌آوری در روز",
    pkgMaxAdAccounts: "حداکثر اکانت تبلیغاتی",
    pkgMaxCampaigns: "حداکثر کمپین",
    pkgRetentionDays: "نگهداری داده (روز)",
    pkgUnlimited: "نامحدود",
    pkgUnlimitedPlaceholder: "خالی = نامحدود",
    pkgDefaultKpis: "KPI پیش‌فرض",
    pkgFeatures: "امکانات",
    pkgPricingDefaults: "پیش‌فرض قیمت‌گذاری",
    pkgEditTitle: "ویرایش پکیج {name}",
    pkgSave: "ذخیره پکیج",
    pkgSaved: "پکیج با موفقیت ذخیره شد.",
    pkgPricingPercentagePlaceholder: "٪ افزایش",
    pkgPricingFixedPlaceholder: "افزایش ثابت",
    pkgPricingMinimumPlaceholder: "حداقل",
    pkgPricingPercentageAria: "{metric} درصد افزایش",
    pkgPricingFixedAria: "{metric} افزایش ثابت",
    pkgPricingMinimumAria: "{metric} حداقل ارزش",
    featureCharts: "نمودار",
    featureDataExport: "خروجی داده",
    featureAdvancedReporting: "گزارش پیشرفته",

    packageCurrent: "پکیج فعلی",
    packageAssignedAt: "زمان انتساب",
    assignSelectClient: "مشتری",
    assignSelectPackage: "پکیج",
    assignNewPackage: "پکیج جدید",
    assignSelectPackagePlaceholder: "انتخاب پکیج…",
    assignPreviewTitle: "پیش‌نمایش پکیج انتخابی",
    assignNoPackage: "بدون پکیج",
    assignNoClientSelected: "مشتری‌ای انتخاب نشده است.",
    assignButton: "اختصاص پکیج",
    assignButtonBusy: "در حال انتساب...",
    assignSuccess: "پکیج با موفقیت اختصاص یافت.",
    assignSuccessChanged:
      "پکیج با موفقیت تغییر کرد. زمان انتساب: {date} — قوانین قیمت‌گذاری ایجادشده: {count}",
    assignSuccessUnchanged:
      "پکیج تغییری نکرد (همان پکیج فعلی بود). قوانین قیمت‌گذاری ایجادشده: {count}",

    kpiConfigClient: "مشتری",
    kpiConfigSave: "ذخیره تنظیمات",
    kpiConfigSaving: "در حال ذخیره...",
    kpiConfigSaved: "تنظیمات با موفقیت ذخیره شد.",
    kpiConfigEmpty: "مشتری‌ای برای تنظیم وجود ندارد.",
    kpiConfigNoAssigned: "هیچ مشتری‌ای به شما اختصاص داده نشده است.",

    pricingMetric: "متریک",
    pricingRawValue: "ارزش خام متا",
    pricingRule: "قانون قیمت‌گذاری",
    pricingCustomerValue: "ارزش مشتری",
    pricingNoRule: "بدون قانون قیمت‌گذاری",
    pricingNoRuleShort: "بدون قانون",
    pricingApplied: "قیمت‌گذاری اعمال شد",
    pricingUnchanged: "بدون تغییر",
    pricingClientTitle: "قیمت‌گذاری مشتری",
    pricingEffectiveFrom: "از {date}",
    pricingNewRuleTitle: "قانون جدید قیمت‌گذاری",
    pricingPercentage: "درصد افزایش (٪)",
    pricingPercentagePlaceholder: "مثلاً 40",
    pricingFixed: "افزایش ثابت (دلار)",
    pricingFixedPlaceholder: "مثلاً 1.00",
    pricingMinimum: "حداقل ارزش مشتری (دلار)",
    pricingMinimumPlaceholder: "مثلاً 0.75",
    pricingEffectiveDate: "تاریخ اعتبار",
    pricingSaveRule: "ذخیره قانون",
    pricingSaving: "در حال ذخیره...",
    pricingRuleSaved:
      "قانون جدید ثبت شد. در صورت نیاز، از نظر سرور یک قانون جدید با تاریخ اعتبار دلخواه ساخته می‌شود و قانون قبلی تغییری نمی‌کند.",
    pricingComponentsHint: "حداقل یکی از سه جزء قیمت‌گذاری را وارد کنید.",
    pricingPreviewTitle: "پیش‌نمایش برای {kpi}",
    pricingPreviewNewRule: "پیش‌نمایش قانون جدید",
    pricingPreviewNewValue: "ارزش مشتری جدید",
    pricingPreviewNote:
      "ارزش خام متا هرگز تغییر نمی‌کند؛ فرمول قیمت‌گذاری فقط روی ارزش مشتری اعمال می‌شود.",
    pricingHistoryTitle: "تاریخچه‌ی قوانین — {kpi}",
    pricingRuleCurrent: "قانون فعلی",
    pricingRuleScheduled: "قوانین زمان‌بندی‌شده",
    pricingRuleHistorical: "قوانین قبلی",
    pricingRuleCurrentEmpty: "قانونی در حال حاضر اعمال نمی‌شود.",
    pricingRuleScheduledEmpty: "قانونی برای آینده برنامه‌ریزی نشده است.",
    pricingRuleHistoricalEmpty: "قانون قبلی‌ای ثبت نشده است.",
    pricingSelectClientPrompt:
      "برای مشاهده‌ی قیمت‌گذاری، ابتدا یک مشتری انتخاب کنید.",
    pricingConfigSelectClientPrompt:
      "برای تنظیم قیمت‌گذاری، ابتدا یک مشتری انتخاب کنید.",

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
    navAdminOverview: "Admin Overview",
    navKpiConfig: "Client KPI Setup",
    navClients: "Clients",
    navPackages: "Packages",
    navAssignPackage: "Assign Package",
    navPricingReview: "Pricing Review",
    navPricingConfig: "Pricing Settings",
    welcome: "Welcome,",
    signOut: "Sign out",
    languageLabel: "Language",

    adminOverviewTitle: "Admin Overview",
    adminOverviewSubtitle:
      "Control and monitor clients, ad accounts and packages",
    adminSelectClient: "Client",
    adminSelectClientPlaceholder: "Select a client…",
    adminNoClientSelected:
      "Select a client first to view its KPIs.",
    adminNoClientSelectedHint:
      "KPIs are shown with English titles and Persian explanations.",
    adminNoData: "No collected data for this client.",
    adminSummaryClients: "Clients",
    adminSummaryAdAccounts: "Ad accounts",
    adminSummaryPackages: "Packages",
    adminSummaryCampaigns: "Campaigns with data",
    adminKpiHelp: "About {kpi}",

    adminClientsTitle: "Client Management",
    adminClientsSubtitle:
      "Manage clients, their assigned package and ad accounts.",
    adminClientDetailSubtitle: "Manage ad accounts for {name}.",
    adminKpiConfigTitle: "Client KPI Setup",
    adminKpiConfigSubtitle:
      "Choose which KPIs each client sees on their dashboard.",
    adminPackagesTitle: "Packages",
    adminPackagesSubtitle:
      "Packages are editable data; settings are stored and cleaned through the shared validation.",
    adminAssignTitle: "Assign Package",
    adminAssignSubtitle:
      "After assignment, the package's pricing defaults are applied to the client automatically.",
    adminPricingTitle: "Pricing Review",
    adminPricingSubtitle:
      "Complete pricing path: raw Meta value ← pricing rule ← customer value",
    adminPricingConfigTitle: "Pricing Settings",
    adminPricingConfigSubtitle:
      "Define a new effective rule per metric. Rules are append-only and never changed or removed.",

    clientNew: "New client",
    clientCreateSaving: "Saving...",
    clientCreated: "Client created successfully.",
    clientCancel: "Cancel",
    clientNameLabel: "Name",
    clientNamePlaceholder: "e.g. Online store",
    clientNameRequired: "Name cannot be empty.",
    clientBusinessLabel: "Business type",
    clientBusinessPlaceholder: "e.g. Retail",
    clientEmailLabel: "Contact email",
    clientEmailPlaceholder: "client@example.com",
    clientPackageLabel: "Package",
    clientActive: "Active",
    clientInactive: "Inactive",
    clientPackageField: "Package:",
    clientAdAccountField: "Ad accounts:",
    clientEmailField: "Email:",
    clientManageAccounts: "Manage accounts",
    clientDeactivate: "Deactivate",
    clientDeactivateConfirm: "Deactivate client «{name}»?",
    clientEmpty: "No clients defined yet.",
    clientNoAssigned: "No clients are assigned to you.",

    adAccountNew: "New ad account",
    adAccountPackageLimit: "Package {package}: max {max} accounts",
    adAccountEmpty: "This client has no ad accounts yet.",
    adAccountMetaIdLabel: "Meta ad account ID",
    adAccountMetaIdPlaceholder: "e.g. 2001900877879672",
    adAccountSave: "Save",
    adAccountSaved: "Saved.",
    adAccountStatusLabel: "Status:",
    adAccountStatusUpdated: "Status updated.",
    adAccountLimitReached:
      "This client's ad-account limit is reached; upgrade the package first.",
    adAccountNamePlaceholder: "e.g. Main account",
    adAccountMetaIdOptional: "Meta ad account ID (optional)",
    adAccountCreate: "Create account",
    adAccountCreated: "Account created successfully.",
    statusConnected: "Connected",
    statusPending: "Pending",
    statusError: "Error",

    packageNew: "New package",
    packageEdit: "Edit",
    packageEmpty: "No packages defined yet.",
    pkgNameLabel: "Name",
    pkgCodeLabel: "Package code",
    pkgCodePlaceholder: "e.g. premium",
    pkgCodeRequired: "Package code cannot be empty.",
    pkgDescriptionLabel: "Description",
    pkgCollectionFrequency: "Collection frequency per day",
    pkgMaxAdAccounts: "Max ad accounts",
    pkgMaxCampaigns: "Max campaigns",
    pkgRetentionDays: "Data retention (days)",
    pkgUnlimited: "Unlimited",
    pkgUnlimitedPlaceholder: "empty = unlimited",
    pkgDefaultKpis: "Default KPIs",
    pkgFeatures: "Features",
    pkgPricingDefaults: "Pricing defaults",
    pkgEditTitle: "Edit package {name}",
    pkgSave: "Save package",
    pkgSaved: "Package saved successfully.",
    pkgPricingPercentagePlaceholder: "% markup",
    pkgPricingFixedPlaceholder: "Fixed markup",
    pkgPricingMinimumPlaceholder: "Minimum",
    pkgPricingPercentageAria: "{metric} percentage markup",
    pkgPricingFixedAria: "{metric} fixed markup",
    pkgPricingMinimumAria: "{metric} minimum value",
    featureCharts: "Charts",
    featureDataExport: "Data export",
    featureAdvancedReporting: "Advanced reporting",

    packageCurrent: "Current package",
    packageAssignedAt: "Assigned at",
    assignSelectClient: "Client",
    assignSelectPackage: "Package",
    assignNewPackage: "New package",
    assignSelectPackagePlaceholder: "Select a package…",
    assignPreviewTitle: "Selected package preview",
    assignNoPackage: "No package",
    assignNoClientSelected: "No client selected.",
    assignButton: "Assign package",
    assignButtonBusy: "Assigning...",
    assignSuccess: "Package assigned successfully.",
    assignSuccessChanged:
      "Package changed. Assigned at: {date} — pricing rules created: {count}",
    assignSuccessUnchanged:
      "Package unchanged (same as current). Pricing rules created: {count}",

    kpiConfigClient: "Client",
    kpiConfigSave: "Save settings",
    kpiConfigSaving: "Saving...",
    kpiConfigSaved: "Settings saved successfully.",
    kpiConfigEmpty: "No clients to configure.",
    kpiConfigNoAssigned: "No clients are assigned to you.",

    pricingMetric: "Metric",
    pricingRawValue: "Raw Meta value",
    pricingRule: "Pricing rule",
    pricingCustomerValue: "Customer value",
    pricingNoRule: "No pricing rule",
    pricingNoRuleShort: "No rule",
    pricingApplied: "Pricing applied",
    pricingUnchanged: "No change",
    pricingClientTitle: "Client pricing",
    pricingEffectiveFrom: "From {date}",
    pricingNewRuleTitle: "New pricing rule",
    pricingPercentage: "Percentage markup (%)",
    pricingPercentagePlaceholder: "e.g. 40",
    pricingFixed: "Fixed markup (USD)",
    pricingFixedPlaceholder: "e.g. 1.00",
    pricingMinimum: "Minimum customer value (USD)",
    pricingMinimumPlaceholder: "e.g. 0.75",
    pricingEffectiveDate: "Effective date",
    pricingSaveRule: "Save rule",
    pricingSaving: "Saving...",
    pricingRuleSaved:
      "Rule saved. A new rule with the desired effective date is created server-side; previous rules are never changed.",
    pricingComponentsHint: "Enter at least one of the three pricing components.",
    pricingPreviewTitle: "Preview for {kpi}",
    pricingPreviewNewRule: "New rule preview",
    pricingPreviewNewValue: "New customer value",
    pricingPreviewNote:
      "The raw Meta value never changes; pricing applies only to the customer value.",
    pricingHistoryTitle: "Rule history — {kpi}",
    pricingRuleCurrent: "Current rule",
    pricingRuleScheduled: "Scheduled rules",
    pricingRuleHistorical: "Previous rules",
    pricingRuleCurrentEmpty: "No rule currently applies.",
    pricingRuleScheduledEmpty: "No rules scheduled.",
    pricingRuleHistoricalEmpty: "No previous rules.",
    pricingSelectClientPrompt: "Select a client to view pricing.",
    pricingConfigSelectClientPrompt: "Select a client to configure pricing.",

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

/**
 * Admin KPI group labels in English. The Admin pages keep every KPI name
 * in English regardless of the UI language (deliberate product decision),
 * and the shared KPI group labels are Persian-only — so this small map is
 * the admin layer's own source of truth, mirroring the catalog groups.
 */
export const KPI_GROUP_LABELS_EN: Record<KpiGroup, string> = {
  performance: "Performance",
  traffic: "Traffic",
  conversions: "Conversions",
  messaging: "Messaging",
  engagement: "Engagement",
  cost: "Cost",
};

/**
 * The official English title of a KPI, used on every ADMIN page in both
 * languages. Falls back to the key itself for unknown keys (never crashes).
 * The client-facing dashboard keeps using getKpiLabel instead.
 */
export function getAdminKpiTitle(key: DashboardKpiKey): string {
  return KPI_LABELS_EN[key] ?? key;
}

/**
 * The short Persian explanation shown in the Admin KPI help tooltip.
 * Reuses the shared catalog's Persian description (single source of
 * truth) rather than inventing a duplicate definition.
 */
export function getAdminKpiDescription(key: DashboardKpiKey): string {
  return KPI_CATALOG_BY_KEY.get(key)?.description ?? key;
}
