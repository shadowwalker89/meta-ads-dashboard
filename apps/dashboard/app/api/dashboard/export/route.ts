import { NextRequest, NextResponse } from "next/server";
import { AccessError, requireUser } from "@/lib/access";
import { DEFAULT_REPORTING_PERIOD, isReportingPeriod } from "@/lib/dashboard-period";
import { runGetDashboardExport, toCsvFileBytes } from "@/lib/dashboard-export";

/**
 * GET /api/dashboard/export?range=30
 *
 * Streams the currently displayed client dashboard data as a CSV
 * download. Everything is resolved server-side:
 *
 *   - identity comes from the session cookie (requireUser), never from
 *     the query string;
 *   - clientId is derived from that session, never from request input;
 *   - `range` is validated against the 7/30/90 whitelist and falls back
 *     to the default, matching the dashboard page;
 *   - the package dataExport feature flag and KPI visibility are
 *     enforced inside runGetDashboardExport before any data is read.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AccessError) {
      return new NextResponse(error.message, { status: 401 });
    }
    return new NextResponse("خطای داخلی", { status: 500 });
  }

  const rawRange = request.nextUrl.searchParams.get("range");
  const rangeDays = isReportingPeriod(rawRange)
    ? rawRange
    : DEFAULT_REPORTING_PERIOD;

  // clientId is derived from the authenticated session, never from the
  // request; the orchestrator re-verifies it through requireClientAccess.
  const clientId = user.clientId;
  if (!clientId) {
    return new NextResponse("خروجی داده فقط برای حساب مشتری در دسترس است.", {
      status: 403,
    });
  }

  try {
    const { csv, filename } = await runGetDashboardExport(user, clientId, rangeDays);
    // UTF-8 BOM bytes so Excel/LibreOffice decode the Persian text correctly.
    return new NextResponse(toCsvFileBytes(csv), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AccessError) {
      return new NextResponse(error.message, { status: 403 });
    }
    return new NextResponse("خطای داخلی در تهیه‌ی خروجی", { status: 500 });
  }
}