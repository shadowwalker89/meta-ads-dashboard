import type { DashboardKpiKey, KpiFormat } from "@repo/shared";
import { KPI_CATALOG_BY_KEY } from "@repo/shared";

const numberFormatter = new Intl.NumberFormat("fa-IR");
const currencyFormatter = new Intl.NumberFormat("fa-IR", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const currencyCentsFormatter = new Intl.NumberFormat("fa-IR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const ratioFormatter = new Intl.NumberFormat("fa-IR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatByType(format: KpiFormat, value: number): string {
  switch (format) {
    case "currency":
      return currencyFormatter.format(value);
    case "currencyCents":
      return currencyCentsFormatter.format(value);
    case "percentage":
      return `${numberFormatter.format(value)}%`;
    case "ratio":
      return ratioFormatter.format(value);
    case "integer":
    default:
      return numberFormatter.format(value);
  }
}

/**
 * Formats a KPI value for display using the format declared in the
 * shared KPI catalog. Unknown keys fall back to a plain integer
 * grouping rather than crashing.
 */
export function formatKpiValue(key: DashboardKpiKey, value: number): string {
  const definition = KPI_CATALOG_BY_KEY.get(key);
  if (!definition) {
    return numberFormatter.format(value);
  }
  return formatByType(definition.format, value);
}