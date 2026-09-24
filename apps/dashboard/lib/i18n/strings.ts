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
  navUsers: string;
  adminUsersTitle: string;
  adminUsersSubtitle: string;
  adminUsersCreate: string;
  adminUsersEmpty: string;
  adminUsersName: string;
  adminUsersEmail: string;
  adminUsersRole: string;
  adminUsersClient: string;
  adminUsersCreatedAt: string;
  adminUsersRoleAdmin: string;
  adminUsersRoleClient: string;
  adminUsersNoClient: string;
  adminUsersCreateTitle: string;
  adminUsersCreateName: string;
  adminUsersCreateEmail: string;
  adminUsersCreatePassword: string;
  adminUsersCreateRole: string;
  adminUsersCreateClient: string;
  adminUsersCreateSubmit: string;
  adminUsersCreateSaving: string;
  adminUsersCreated: string;
  adminUsersCreatedAuditWarning: string;
  adminUsersCancel: string;
  adminUsersInvalidInput: string;
  adminUsersDuplicate: string;
  adminUsersAuthDuplicate: string;
  adminUsersForbidden: string;
  adminUsersAuthError: string;
  adminUsersApplicationError: string;
  adminUsersUnknownError: string;
  adminUsersEdit: string;
  adminUsersStatus: string;
  adminUsersActive: string;
  adminUsersInactive: string;
  adminUsersEditTitle: string;
  adminUsersEditName: string;
  adminUsersEditRole: string;
  adminUsersEditClient: string;
  adminUsersEditSubmit: string;
  adminUsersEditSaving: string;
  adminUsersEdited: string;
  adminUsersEditedAuditWarning: string;
  adminUsersActivate: string;
  adminUsersActivated: string;
  adminUsersDeactivate: string;
  adminUsersDeactivated: string;
  adminUsersStatusChanging: string;
  adminUsersNotFound: string;
  adminUsersProtectedSuperAdmin: string;
  adminUsersSelfDeactivation: string;
  adminUsersLastAdmin: string;
  adminUsersClientScope: string;
  adminUsersRoleNotEditable: string;
  adminUsersNotEditable: string;
  adminUsersStatusChangeForbidden: string;
  adminUsersEditEmailReadonly: string;
  loginInactiveAccount: string;
  loginInvalidCredentials: string;
  adminUsersSetPassword: string;
  adminUsersSetPasswordTitle: string;
  adminUsersSetPasswordLabel: string;
  adminUsersSetPasswordPlaceholder: string;
  adminUsersSetPasswordSubmit: string;
  adminUsersSetPasswordSaving: string;
  adminUsersPasswordUpdated: string;
  adminUsersPasswordUpdatedAuditWarning: string;
  adminUsersPasswordTooShort: string;
  adminUsersPasswordNoAuthIdentity: string;
  adminUsersPasswordConfigurationError: string;
  adminUsersPasswordAuthError: string;

  // Client management
  clientEdit: string;
  clientSave: string;
  clientUpdated: string;
  clientInvalidInput: string;
  clientInvalidPackage: string;
  clientLoginHint: string;
  clientSaveError: string;
  kpiOverrideEnabled: string;
  kpiInherited: string;
  kpiOverrideHint: string;
  backToClients: string;
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
  kpiHelpAria: string;

  // Advanced reporting placeholder surface
  advancedTitle: string;
  advancedDescription: string;
  advancedEmpty: string;

  // Campaign ownership management
  navCampaigns: string;
  campaignOwnershipTitle: string;
  campaignOwnershipDescription: string;
  campaignOwnershipEmpty: string;
  campaignOwnershipSelectClient: string;
  campaignOwnershipNoClient: string;
  campaignTableCampaign: string;
  campaignTableEffectiveOwner: string;
  campaignTableSource: string;
  campaignTableTarget: string;
  campaignOwnershipExplicit: string;
  campaignOwnershipInherited: string;
  campaignOwnershipNone: string;
  campaignTargetSelectPlaceholder: string;
  campaignAssignButton: string;
  campaignAssignBusy: string;
  campaignChangeButton: string;
  campaignChangeBusy: string;
  campaignDeactivateButton: string;
  campaignDeactivateBusy: string;
  campaignAssignedSuccess: string;
  campaignChangedSuccess: string;
  campaignDeactivatedSuccess: string;
  campaignActionError: string;

  // Audit activity (client detail)
  auditActivityTitle: string;
  auditActivityDescription: string;
  auditActivityEmpty: string;
  auditActivityLoadMore: string;
  auditActivityActorFallback: string;
  auditActivityUnknownAction: string;
  /** Filled with {actor}. */
  auditActivityByActor: string;
  auditActionPackageAssigned: string;
  auditActionPackageCreated: string;
  auditActionPackageUpdated: string;
  auditActionPricingRuleCreated: string;
  auditActionKpiConfigChanged: string;
  auditActionClientCreated: string;
  auditActionClientUpdated: string;
  auditActionClientDeactivated: string;
  auditActionAdAccountCreated: string;
  auditActionAdAccountSourceUpdated: string;
  auditActionAdAccountStatusUpdated: string;
  auditActionCampaignAssigned: string;
  auditActionCampaignAssignmentChanged: string;
  auditActionCampaignAssignmentDeactivated: string;
  auditActionDataExportCreated: string;
  auditActionUserCreated: string;
  auditActionUserUpdated: string;
  auditActionUserActivated: string;
  auditActionUserDeactivated: string;
  auditActivityMetadataPackageReassigned: string;
  auditActivityMetadataPackageAssigned: string;
  auditActivityMetadataPackageChanged: string;
  /** Filled with {metric}. */
  auditActivityMetadataPricingRuleCreated: string;
  auditActivityMetadataPricingRuleCreatedGeneric: string;
  /** Filled with {kpis}. */
  auditActivityMetadataKpiConfigChanged: string;
  auditActivityMetadataKpiConfigChangedGeneric: string;
  /** Filled with {name}. */
  auditActivityMetadataClientCreated: string;
  auditActivityMetadataClientCreatedGeneric: string;
  /** Filled with {name}, {previousName}. */
  auditActivityMetadataClientRenamed: string;
  /** Filled with {status}. */
  auditActivityMetadataClientStatusChanged: string;
  auditActivityMetadataClientUpdated: string;
  /** Filled with {name}. */
  auditActivityMetadataClientDeactivated: string;
  auditActivityMetadataClientDeactivatedGeneric: string;
  /** Filled with {range}, {rows}. */
  auditActivityMetadataDataExportCreated: string;
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
    navUsers: "مدیریت کاربران",
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
    adminUsersTitle: "مدیریت کاربران",
    adminUsersSubtitle: "کاربران برنامه و دسترسی مشتریان را مدیریت کنید.",
    adminUsersCreate: "ایجاد کاربر",
    adminUsersEmpty: "هنوز کاربری ایجاد نشده است.",
    adminUsersName: "نام",
    adminUsersEmail: "ایمیل",
    adminUsersRole: "نقش",
    adminUsersClient: "مشتری",
    adminUsersCreatedAt: "تاریخ ایجاد",
    adminUsersRoleAdmin: "ادمین",
    adminUsersRoleClient: "مشتری",
    adminUsersNoClient: "بدون مشتری",
    adminUsersCreateTitle: "ایجاد کاربر جدید",
    adminUsersCreateName: "نام کامل",
    adminUsersCreateEmail: "ایمیل",
    adminUsersCreatePassword: "رمز عبور اولیه",
    adminUsersCreateRole: "نقش",
    adminUsersCreateClient: "مشتری",
    adminUsersCreateSubmit: "ایجاد کاربر",
    adminUsersCreateSaving: "در حال ایجاد...",
    adminUsersCreated: "کاربر با موفقیت ایجاد شد.",
    adminUsersCreatedAuditWarning: "کاربر ایجاد شد، اما ثبت رویداد ممیزی کامل نشد.",
    adminUsersCancel: "انصراف",
    adminUsersInvalidInput: "اطلاعات واردشده معتبر نیست.",
    adminUsersDuplicate: "کاربری با این ایمیل از قبل وجود دارد.",
    adminUsersAuthDuplicate: "این ایمیل در احراز هویت Supabase از قبل وجود دارد و نیاز به پیوند صریح دارد.",
    adminUsersForbidden: "شما اجازه ایجاد این کاربر را ندارید.",
    adminUsersAuthError: "ایجاد حساب احراز هویت انجام نشد.",
    adminUsersApplicationError: "ذخیره کاربر برنامه انجام نشد.",
    adminUsersUnknownError: "ایجاد کاربر انجام نشد.",
    adminUsersEdit: "ویرایش",
    adminUsersStatus: "وضعیت",
    adminUsersActive: "فعال",
    adminUsersInactive: "غیرفعال",
    adminUsersEditTitle: "ویرایش کاربر",
    adminUsersEditName: "نام",
    adminUsersEditRole: "نقش",
    adminUsersEditClient: "مشتری",
    adminUsersEditSubmit: "ذخیره تغییرات",
    adminUsersEditSaving: "در حال ذخیره...",
    adminUsersEdited: "تغییرات کاربر ذخیره شد.",
    adminUsersEditedAuditWarning: "تغییرات کاربر ذخیره شد، اما ثبت رویداد ممیزی کامل نشد.",
    adminUsersActivate: "فعال‌سازی",
    adminUsersDeactivate: "غیرفعال‌سازی",
    adminUsersActivated: "کاربر فعال شد.",
    adminUsersDeactivated: "کاربر غیرفعال شد.",
    adminUsersStatusChanging: "در حال تغییر وضعیت...",
    adminUsersNotFound: "کاربر یافت نشد.",
    adminUsersProtectedSuperAdmin: "این کاربر super_admin است و قابل ویرایش نیست.",
    adminUsersSelfDeactivation: "نمی‌توانید حساب کاربری خودتان را غیرفعال کنید.",
    adminUsersLastAdmin: "نمی‌توان آخرین ادمین فعال را غیرفعال کرد.",
    adminUsersClientScope: "به این مشتری دسترسی ندارید.",
    adminUsersRoleNotEditable: "این نقش قابل ویرایش نیست.",
    adminUsersNotEditable: "این کاربر قابل ویرایش نیست.",
    adminUsersStatusChangeForbidden: "تغییر وضعیت این کاربر مجاز نیست.",
    adminUsersEditEmailReadonly: "برای تغییر ایمیل، ابتدا کاربر حذف و دوباره ایجاد شود.",
    loginInactiveAccount: "حساب کاربری شما غیرفعال است. لطفاً با مدیر سیستم تماس بگیرید.",
    loginInvalidCredentials: "ایمیل یا رمز عبور نادرست است.",
    adminUsersSetPassword: "تغییر رمز عبور",
    adminUsersSetPasswordTitle: "تغییر رمز عبور کاربر",
    adminUsersSetPasswordLabel: "رمز عبور جدید",
    adminUsersSetPasswordPlaceholder: "حداقل ۸ کاراکتر",
    adminUsersSetPasswordSubmit: "ذخیره رمز عبور",
    adminUsersSetPasswordSaving: "در حال ذخیره...",
    adminUsersPasswordUpdated: "رمز عبور کاربر به‌روزرسانی شد.",
    adminUsersPasswordUpdatedAuditWarning: "رمز عبور به‌روزرسانی شد، اما ثبت رویداد ممیزی کامل نشد.",
    adminUsersPasswordTooShort: "رمز عبور باید حداقل ۸ کاراکتر باشد.",
    adminUsersPasswordNoAuthIdentity: "این کاربر حساب احراز هویت ندارد.",
    adminUsersPasswordConfigurationError: "تنظیمات سرور برای تغییر رمز عبور کامل نیست.",
    adminUsersPasswordAuthError: "تغییر رمز عبور در سرور احراز هویت انجام نشد.",

    clientEdit: "ویرایش مشتری",
    clientSave: "ذخیره تغییرات",
    clientUpdated: "تغییرات با موفقیت ذخیره شد.",
    clientInvalidInput: "ورودی نامعتبر است؛ فیلدهای الزامی را بررسی کنید.",
    clientInvalidPackage: "پکیج انتخابی معتبر نیست.",
    clientLoginHint: "ورود مشتری از طریق حساب کاربری از قبل تعریف‌شده انجام می‌شود.",
    clientSaveError: "ذخیره‌سازی ناموفق بود.",
    kpiOverrideEnabled: "پیکربندی سفارشی (لغو پیش‌فرض پکیج)",
    kpiInherited: "بدون لغو — پیش‌فرض پکیج اعمال می‌شود",
    kpiOverrideHint:
      "پیش‌فرض هر مشتری از پکیج او می‌آید. در صورت ذخیره‌ی تنظیمات سفارشی، همین انتخاب‌ها جایگزین پیش‌فرض پکیج می‌شود.",
    backToClients: "بازگشت به مشتریان",
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

    navCampaigns: "کمپین‌ها",
    campaignOwnershipTitle: "مدیریت مالکیت کمپین‌ها",
    campaignOwnershipDescription:
      "انتساب صریح کمپین به مشتری یا بازگرداندن مالکیت طبیعی از طریق اکانت تبلیغاتی.",
    campaignOwnershipEmpty: "کمپینی برای نمایش وجود ندارد.",
    campaignOwnershipSelectClient: "مشتری",
    campaignOwnershipNoClient: "هیچ مشتری‌ای در دسترس نیست.",
    campaignTableCampaign: "کمپین",
    campaignTableEffectiveOwner: "مالک فعلی",
    campaignTableSource: "نوع مالکیت",
    campaignTableTarget: "مشتری هدف",
    campaignOwnershipExplicit: "انتساب صریح",
    campaignOwnershipInherited: "از اکانت تبلیغاتی",
    campaignOwnershipNone: "بدون مالک",
    campaignTargetSelectPlaceholder: "انتخاب مشتری…",
    campaignAssignButton: "انتساب",
    campaignAssignBusy: "در حال انتساب…",
    campaignChangeButton: "تغییر مشتری",
    campaignChangeBusy: "در حال تغییر…",
    campaignDeactivateButton: "لغو انتساب",
    campaignDeactivateBusy: "در حال لغو…",
    campaignAssignedSuccess: "کمپین به مشتری انتخاب‌شده منتسب شد.",
    campaignChangedSuccess: "مالکیت کمپین تغییر کرد.",
    campaignDeactivatedSuccess: "انتساب کمپین لغو شد.",
    campaignActionError: "انجام عملیات ناموفق بود.",

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
    kpiHelpAria: "راهنمای شاخص",

    advancedTitle: "گزارش پیشرفته",
    advancedDescription: "گزارش‌های تحلیلی فراتر از شاخص‌های اصلی",
    advancedEmpty: "گزارش پیشرفته به‌زودی در این بخش ارائه می‌شود.",

    auditActivityTitle: "فعالیت ممیزی",
    auditActivityDescription:
      "تاریخچه‌ی اقدامات ثبت‌شده روی این مشتری، فقط برای ادمین‌ها.",
    auditActivityEmpty: "هیچ فعالیت ممیزی‌ای برای این مشتری ثبت نشده است.",
    auditActivityLoadMore: "بارگذاری بیشتر",
    auditActivityActorFallback: "کاربر حذف‌شده",
    auditActivityUnknownAction: "اقدام نامشخص",
    auditActivityByActor: "توسط {actor}",
    auditActionPackageAssigned: "پکیج اختصاص داده شد",
    auditActionPackageCreated: "پکیج ایجاد شد",
    auditActionPackageUpdated: "پکیج به‌روزرسانی شد",
    auditActionPricingRuleCreated: "قانون قیمت‌گذاری ایجاد شد",
    auditActionKpiConfigChanged: "تنظیم KPI تغییر کرد",
    auditActionClientCreated: "مشتری ایجاد شد",
    auditActionClientUpdated: "مشتری به‌روزرسانی شد",
    auditActionClientDeactivated: "مشتری غیرفعال شد",
    auditActionAdAccountCreated: "اکانت تبلیغاتی ایجاد شد",
    auditActionAdAccountSourceUpdated: "منبع اکانت تبلیغاتی تغییر کرد",
    auditActionAdAccountStatusUpdated: "وضعیت اکانت تبلیغاتی تغییر کرد",
    auditActionCampaignAssigned: "کمپین منتسب شد",
    auditActionCampaignAssignmentChanged: "انتساب کمپین تغییر کرد",
    auditActionCampaignAssignmentDeactivated: "انتساب کمپین لغو شد",
    auditActionDataExportCreated: "خروجی داده ایجاد شد",
    auditActionUserCreated: "کاربر ایجاد شد",
    auditActionUserUpdated: "کاربر به‌روزرسانی شد",
    auditActionUserActivated: "کاربر فعال شد",
    auditActionUserDeactivated: "کاربر غیرفعال شد",
    auditActivityMetadataPackageReassigned: "پکیج مجدداً اختصاص یافت",
    auditActivityMetadataPackageAssigned: "پکیج اختصاص یافت",
    auditActivityMetadataPackageChanged: "پکیج تغییر کرد",
    auditActivityMetadataPricingRuleCreated: "برای {metric}",
    auditActivityMetadataPricingRuleCreatedGeneric: "قانون قیمت‌گذاری جدید",
    auditActivityMetadataKpiConfigChanged: "شاخص‌ها: {kpis}",
    auditActivityMetadataKpiConfigChangedGeneric: "شاخص‌های قابل مشاهده تغییر کردند",
    auditActivityMetadataClientCreated: "«{name}»",
    auditActivityMetadataClientCreatedGeneric: "مشتری جدید",
    auditActivityMetadataClientRenamed: "از «{previousName}» به «{name}»",
    auditActivityMetadataClientStatusChanged: "وضعیت: {status}",
    auditActivityMetadataClientUpdated: "اطلاعات مشتری ویرایش شد",
    auditActivityMetadataClientDeactivated: "«{name}»",
    auditActivityMetadataClientDeactivatedGeneric: "مشتری غیرفعال شد",
    auditActivityMetadataDataExportCreated: "بازه‌ی {range} روز — {rows} ردیف",
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
    navUsers: "Users",
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
    adminUsersTitle: "User Management",
    adminUsersSubtitle: "Manage application users and client access.",
    adminUsersCreate: "Create user",
    adminUsersEmpty: "No users have been created yet.",
    adminUsersName: "Name",
    adminUsersEmail: "Email",
    adminUsersRole: "Role",
    adminUsersClient: "Client",
    adminUsersCreatedAt: "Created",
    adminUsersRoleAdmin: "Admin",
    adminUsersRoleClient: "Client",
    adminUsersNoClient: "No client",
    adminUsersCreateTitle: "Create user",
    adminUsersCreateName: "Full name",
    adminUsersCreateEmail: "Email",
    adminUsersCreatePassword: "Initial password",
    adminUsersCreateRole: "Role",
    adminUsersCreateClient: "Client",
    adminUsersCreateSubmit: "Create user",
    adminUsersCreateSaving: "Creating...",
    adminUsersCreated: "User created successfully.",
    adminUsersCreatedAuditWarning: "User created, but audit recording did not complete.",
    adminUsersCancel: "Cancel",
    adminUsersInvalidInput: "Please check the entered information.",
    adminUsersDuplicate: "An application user with this email already exists.",
    adminUsersAuthDuplicate: "This email already exists in Supabase Auth and requires explicit linking.",
    adminUsersForbidden: "You are not allowed to create this user.",
    adminUsersAuthError: "The authentication account could not be created.",
    adminUsersApplicationError: "The application user could not be saved.",
    adminUsersUnknownError: "The user could not be created.",
    adminUsersEdit: "Edit",
    adminUsersStatus: "Status",
    adminUsersActive: "Active",
    adminUsersInactive: "Inactive",
    adminUsersEditTitle: "Edit user",
    adminUsersEditName: "Full name",
    adminUsersEditRole: "Role",
    adminUsersEditClient: "Client",
    adminUsersEditSubmit: "Save changes",
    adminUsersEditSaving: "Saving...",
    adminUsersEdited: "User updated successfully.",
    adminUsersEditedAuditWarning: "User updated, but audit recording did not complete.",
    adminUsersActivate: "Activate",
    adminUsersDeactivate: "Deactivate",
    adminUsersActivated: "User activated.",
    adminUsersDeactivated: "User deactivated.",
    adminUsersStatusChanging: "Updating status...",
    adminUsersNotFound: "User not found.",
    adminUsersProtectedSuperAdmin: "This user is a protected super_admin and cannot be edited.",
    adminUsersSelfDeactivation: "You cannot deactivate your own account.",
    adminUsersLastAdmin: "The last active admin cannot be deactivated.",
    adminUsersClientScope: "You do not have access to this client.",
    adminUsersRoleNotEditable: "This role cannot be edited.",
    adminUsersNotEditable: "This user cannot be edited.",
    adminUsersStatusChangeForbidden: "Status change is not allowed for this user.",
    adminUsersEditEmailReadonly: "Email changes require deleting and re-provisioning the user.",
    loginInactiveAccount: "Your account is inactive. Please contact an administrator.",
    loginInvalidCredentials: "Email or password is incorrect.",
    adminUsersSetPassword: "Set password",
    adminUsersSetPasswordTitle: "Set user password",
    adminUsersSetPasswordLabel: "New password",
    adminUsersSetPasswordPlaceholder: "Minimum 8 characters",
    adminUsersSetPasswordSubmit: "Save password",
    adminUsersSetPasswordSaving: "Saving...",
    adminUsersPasswordUpdated: "Password updated successfully.",
    adminUsersPasswordUpdatedAuditWarning: "Password updated, but audit recording did not complete.",
    adminUsersPasswordTooShort: "Password must be at least 8 characters.",
    adminUsersPasswordNoAuthIdentity: "This user has no authentication account.",
    adminUsersPasswordConfigurationError: "Server is not configured to change passwords.",
    adminUsersPasswordAuthError: "Password change failed on the authentication server.",

    clientEdit: "Edit client",
    clientSave: "Save changes",
    clientUpdated: "Client updated successfully.",
    clientInvalidInput: "Check the required fields and enter a valid email address.",
    clientInvalidPackage: "Select a valid package.",
    clientLoginHint: "Login uses a separately provisioned user account. Editing contact details does not change login credentials.",
    clientSaveError: "Could not save changes. Please try again.",
    kpiOverrideEnabled: "Use a custom client KPI override",
    kpiInherited: "Using package defaults",
    kpiOverrideHint: "Package KPIs apply by default. Enable an override to customize this client's dashboard; disable it to return to package defaults. Admin metrics are unaffected.",
    backToClients: "Back to clients",
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

    navCampaigns: "Campaigns",
    campaignOwnershipTitle: "Campaign ownership",
    campaignOwnershipDescription:
      "Explicitly assign a campaign to a client, or restore natural AdAccount ownership.",
    campaignOwnershipEmpty: "No campaigns to show.",
    campaignOwnershipSelectClient: "Client",
    campaignOwnershipNoClient: "No clients available.",
    campaignTableCampaign: "Campaign",
    campaignTableEffectiveOwner: "Current owner",
    campaignTableSource: "Ownership source",
    campaignTableTarget: "Target client",
    campaignOwnershipExplicit: "Explicit assignment",
    campaignOwnershipInherited: "From AdAccount",
    campaignOwnershipNone: "No owner",
    campaignTargetSelectPlaceholder: "Select a client…",
    campaignAssignButton: "Assign",
    campaignAssignBusy: "Assigning…",
    campaignChangeButton: "Change client",
    campaignChangeBusy: "Changing…",
    campaignDeactivateButton: "Remove assignment",
    campaignDeactivateBusy: "Removing…",
    campaignAssignedSuccess: "Campaign assigned to the selected client.",
    campaignChangedSuccess: "Campaign ownership changed.",
    campaignDeactivatedSuccess: "Campaign assignment removed.",
    campaignActionError: "The operation could not be completed.",

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
    kpiHelpAria: "Metric help",

    advancedTitle: "Advanced Reporting",
    advancedDescription: "Analytical reports beyond the core metrics",
    advancedEmpty: "Advanced reporting will be available here soon.",

    auditActivityTitle: "Audit Activity",
    auditActivityDescription:
      "Recorded actions on this client, visible to admins only.",
    auditActivityEmpty: "No audit activity has been recorded for this client.",
    auditActivityLoadMore: "Load more",
    auditActivityActorFallback: "Removed user",
    auditActivityUnknownAction: "Unknown action",
    auditActivityByActor: "by {actor}",
    auditActionPackageAssigned: "Package assigned",
    auditActionPackageCreated: "Package created",
    auditActionPackageUpdated: "Package updated",
    auditActionPricingRuleCreated: "Pricing rule created",
    auditActionKpiConfigChanged: "KPI configuration changed",
    auditActionClientCreated: "Client created",
    auditActionClientUpdated: "Client updated",
    auditActionClientDeactivated: "Client deactivated",
    auditActionAdAccountCreated: "Ad account created",
    auditActionAdAccountSourceUpdated: "Ad account source updated",
    auditActionAdAccountStatusUpdated: "Ad account status updated",
    auditActionCampaignAssigned: "Campaign assigned",
    auditActionCampaignAssignmentChanged: "Campaign assignment changed",
    auditActionCampaignAssignmentDeactivated: "Campaign assignment removed",
    auditActionDataExportCreated: "Data export created",
    auditActionUserCreated: "User created",
    auditActionUserUpdated: "User updated",
    auditActionUserActivated: "User activated",
    auditActionUserDeactivated: "User deactivated",
    auditActivityMetadataPackageReassigned: "Package reassigned",
    auditActivityMetadataPackageAssigned: "Package assigned",
    auditActivityMetadataPackageChanged: "Package changed",
    auditActivityMetadataPricingRuleCreated: "for {metric}",
    auditActivityMetadataPricingRuleCreatedGeneric: "New pricing rule",
    auditActivityMetadataKpiConfigChanged: "Metrics: {kpis}",
    auditActivityMetadataKpiConfigChangedGeneric: "Visible metrics changed",
    auditActivityMetadataClientCreated: "“{name}”",
    auditActivityMetadataClientCreatedGeneric: "New client",
    auditActivityMetadataClientRenamed: "from “{previousName}” to “{name}”",
    auditActivityMetadataClientStatusChanged: "Status: {status}",
    auditActivityMetadataClientUpdated: "Client details edited",
    auditActivityMetadataClientDeactivated: "“{name}”",
    auditActivityMetadataClientDeactivatedGeneric: "Client deactivated",
    auditActivityMetadataDataExportCreated: "{range}-day range — {rows} rows",
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
