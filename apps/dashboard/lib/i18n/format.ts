import {
  DASHBOARD_STRINGS,
  localeForLanguage,
  tpl,
  type AppLanguage,
} from "@/lib/i18n/strings";

/**
 * Shared locale-aware date/number formatters for the dashboard group.
 * Formatter instances are cached per locale to avoid recreating
 * Intl objects on every call (cheap and stable). Output is identical to
 * the previous per-page formatters — this is a pure extraction so the
 * Client dashboard and the Admin pages never drift in formatting.
 */
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();
const numberFormatters = new Map<string, Intl.NumberFormat>();

function dateFormatterFor(lang: AppLanguage): Intl.DateTimeFormat {
  const locale = localeForLanguage(lang);
  let formatter = dateFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    dateFormatters.set(locale, formatter);
  }
  return formatter;
}

function dateTimeFormatterFor(lang: AppLanguage): Intl.DateTimeFormat {
  const locale = localeForLanguage(lang);
  let formatter = dateTimeFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    dateTimeFormatters.set(locale, formatter);
  }
  return formatter;
}

function numberFormatterFor(lang: AppLanguage): Intl.NumberFormat {
  const locale = localeForLanguage(lang);
  let formatter = numberFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale);
    numberFormatters.set(locale, formatter);
  }
  return formatter;
}

/** Long date, e.g. "۱۳ اوت ۲۰۲۶" (fa) / "August 13, 2026" (en). */
export function formatDate(lang: AppLanguage, date: Date): string {
  return dateFormatterFor(lang).format(date);
}

/** Long date + time, e.g. "۱۳ اوت ۲۰۲۶، ۱۴:۳۰" (fa). */
export function formatDateTime(lang: AppLanguage, date: Date): string {
  return dateTimeFormatterFor(lang).format(date);
}

/** Locale-grouped integer, e.g. "۳۰" (fa) / "30" (en). */
export function formatNumber(lang: AppLanguage, value: number): string {
  return numberFormatterFor(lang).format(value);
}

/** "From {from} to {to}" using the reporting-range template. */
export function formatRange(
  lang: AppLanguage,
  range: { from: Date; to: Date }
): string {
  return tpl(DASHBOARD_STRINGS[lang].rangeFromTo, {
    from: formatDate(lang, range.from),
    to: formatDate(lang, range.to),
  });
}