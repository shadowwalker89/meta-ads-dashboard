import type { DashboardKpiKey, User } from "@repo/shared";
import { KPI_CATALOG_BY_KEY } from "@repo/shared";
import type { ClientDashboardData } from "@/lib/client-dashboard-data";
import { getClientDashboardData } from "@/lib/client-dashboard-data";
import { getClientKpiConfiguration } from "@/lib/kpi-config";
import { getClientPackageFeatures } from "@/lib/package-features";
import { requireClientAccess, AccessError } from "@/lib/access";
import { sqliteAuditService } from "@/lib/audit";
import { getDatabase } from "@/lib/db";
import type { ReportingPeriod } from "@/lib/dashboard-period";
import { reportingRangeForDays } from "@/lib/dashboard-period";

type Db = ReturnType<typeof getDatabase>;

/**
 * Dashboard CSV export.
 *
 * The export is NOT a separate read: it reuses the exact same authorized
 * dashboard read (getClientDashboardData) that renders the page, so the
 * exported numbers are identical to what the client sees — same
 * aggregation (latest cumulative snapshot per campaign), same pricing
 * layer (customer-facing values), same KPI visibility. Nothing is
 * reimplemented here.
 *
 * Format: one row per campaign + a "جمع کل" (grand total) row using the
 * displayed totals. Columns are the customer-visible identity fields the
 * dashboard table already shows (campaign name, ad account name) plus
 * the collection time (as-of semantics — snapshots are cumulative period
 * totals, never daily activity) plus ONLY the resolved visible KPIs.
 * Internal database IDs, raw snapshots, session data and pricing rule
 * internals are never exported.
 */

/** The only customer-visible identity columns, matching the dashboard table. */
export const EXPORT_IDENTITY_COLUMNS: readonly { key: string; label: string }[] = [
  { key: "campaignName", label: "نام کمپین" },
  { key: "adAccountName", label: "اکانت تبلیغاتی" },
  { key: "capturedAt", label: "زمان جمع‌آوری" },
];

/**
 * RFC-4180-style escaping for one CSV field: quoted when it contains a
 * comma, a double quote, or a line break; embedded quotes are doubled.
 */
export function toCsvField(value: string | number): string {
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Joins one CSV row. Numbers are emitted raw (machine-readable, no digits). */
export function toCsvRow(fields: readonly (string | number)[]): string {
  return fields.map((field) => toCsvField(field)).join(",");
}

/**
 * Formats a metric value for the CSV: rounded to a sane precision so
 * binary floating-point artifacts (e.g. 50 * 1.1 = 55.00000000000001)
 * never leak into a customer file, while genuine precision of rates and
 * ratios (CTR, CPC, ...) is preserved. The value itself is unchanged —
 * this is the same customer-facing number the dashboard shows.
 */
export function formatExportNumber(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 1e6) / 1e6;
  return String(rounded);
}

/**
 * Pure. Builds the export CSV from the already-resolved dashboard data.
 * The identity columns and the KPI columns are a direct projection of
 * what the dashboard page displays; the grand-total row uses the
 * displayed (priced) totals. Empty data produces a header-only CSV —
 * a safe, valid empty export.
 */
export function buildDashboardExportCsv(
  data: ClientDashboardData,
  visibleKpis: DashboardKpiKey[]
): string {
  const header = [
    ...EXPORT_IDENTITY_COLUMNS.map((column) => column.label),
    ...visibleKpis.map((key) => KPI_CATALOG_BY_KEY.get(key)?.label ?? key),
  ];
  const lines: string[] = [toCsvRow(header)];

  for (const campaign of data.campaigns) {
    lines.push(
      toCsvRow([
        campaign.campaignName,
        campaign.adAccountName,
        campaign.capturedAt.toISOString(),
        ...visibleKpis.map((key) => formatExportNumber(campaign.values[key] ?? 0)),
      ])
    );
  }

  if (data.campaigns.length > 0) {
    lines.push(
      toCsvRow([
        "جمع کل",
        "",
        "",
        ...visibleKpis.map((key) => formatExportNumber(data.values[key] ?? 0)),
      ])
    );
  }

  return `${lines.join("\r\n")}\r\n`;
}

/** Filename embeds the reporting window, e.g. dashboard-export-30d.csv. */
export function getDashboardExportFilename(
  rangeDays: ReportingPeriod,
  now: Date = new Date()
): string {
  const stamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `dashboard-export-${rangeDays}d-${stamp}.csv`;
}

export interface DashboardExport {
  csv: string;
  filename: string;
}

/**
 * Server-only. The single authorized export path.
 *
 *   - clientId is derived from the authenticated user's session, never
 *     from request input, and re-verified through the central access
 *     boundary (requireClientAccess).
 *   - The package feature gate is enforced server-side: without the
 *     dataExport entitlement the export is rejected (AccessError,
 *     kind "forbidden") before any data is read.
 *   - KPI visibility and the reporting range come from the same
 *     server-side resolution used by the dashboard page.
 *   - The data itself is read through getClientDashboardData — one
 *     aggregation rule, one pricing layer, one access boundary.
 *   - An audit entry is recorded ONLY after the export succeeded.
 */
export async function runGetDashboardExport(
  user: Pick<User, "role" | "id" | "clientId">,
  clientId: string,
  rangeDays: ReportingPeriod,
  db: Db = getDatabase(),
  now: Date = new Date()
): Promise<DashboardExport> {
  await requireClientAccess(user, clientId, db);

  const features = await getClientPackageFeatures(user, clientId, db);
  if (!features.dataExport) {
    throw new AccessError("forbidden", "خروجی داده برای این مشتری فعال نیست.");
  }

  const visibleKpis = await getClientKpiConfiguration(clientId, db);
  const range = reportingRangeForDays(rangeDays, now);
  const data = await getClientDashboardData(user, clientId, db, range);

  const csv = buildDashboardExportCsv(data, visibleKpis);
  const filename = getDashboardExportFilename(rangeDays);

  await sqliteAuditService(db).recordDataExport(user, clientId, {
    rangeDays,
    rowCount: data.campaigns.length,
  });

  return { csv, filename };
}