import type { DashboardKpiKey, KpiFormat } from "@repo/shared";
import { KPI_CATALOG_BY_KEY } from "@repo/shared";
import {
  localeForLanguage,
  type AppLanguage,
} from "@/lib/i18n/strings";

const formatters = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}:${options ? JSON.stringify(options) : "default"}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    formatters.set(key, formatter);
  }
  return formatter;
}

function formatByType(
  format: KpiFormat,
  value: number,
  locale: string
): string {
  switch (format) {
    case "currency":
      return getFormatter(locale, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);
    case "currencyCents":
      return getFormatter(locale, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    case "percentage":
      return `${getFormatter(locale).format(value)}%`;
    case "ratio":
      return getFormatter(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    case "integer":
    default:
      return getFormatter(locale).format(value);
  }
}

/**
 * Formats a KPI value for display using the format declared in the
 * shared KPI catalog, localized to the dashboard language (fa → Persian
 * digits/currency, en → Latin). Unknown keys fall back to a plain
 * integer grouping rather than crashing.
 */
export function formatKpiValue(
  key: DashboardKpiKey,
  value: number,
  lang: AppLanguage = "fa"
): string {
  const locale = localeForLanguage(lang);
  const definition = KPI_CATALOG_BY_KEY.get(key);
  if (!definition) {
    return getFormatter(locale).format(value);
  }
  return formatByType(definition.format, value, locale);
}