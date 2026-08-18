"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReportingPeriod } from "@/lib/dashboard-period";
import { useDashboardLang } from "@/components/layout/language-provider";

type ExportStatus = "idle" | "loading" | "success" | "error";

/**
 * Data-export entry point, gated behind the package `dataExport`
 * feature flag by the dashboard page. Downloads the currently displayed
 * client dashboard data (same reporting range, same KPI visibility, same
 * customer-facing values) as CSV from the server route. The server
 * re-verifies authorization and the feature flag on every request, so
 * this button is only a convenience entry point — never an authority.
 */
export function DataExportButton({ period }: { period: ReportingPeriod }) {
  const { strings: t } = useDashboardLang();
  const [status, setStatus] = useState<ExportStatus>("idle");

  const handleExport = async () => {
    setStatus("loading");
    try {
      const response = await fetch(`/api/dashboard/export?range=${period}`);
      if (!response.ok) {
        setStatus("error");
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? `dashboard-export-${period}d.csv`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={status === "loading"}
      >
        <Download data-slot="icon" aria-hidden="true" />
        {status === "loading" ? t.exportLoading : t.exportIdle}
      </Button>
      {status === "success" ? (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          {t.exportSuccess}
        </p>
      ) : null}
      {status === "error" ? (
        <p className="text-xs text-destructive">{t.exportError}</p>
      ) : null}
    </div>
  );
}