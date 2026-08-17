"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Data-export entry point, gated behind the package `dataExport`
 * feature flag by the dashboard page. The actual export subsystem does
 * not exist yet — this component is only the correct feature-visibility
 * boundary. It never fabricates an export; clicking it shows an honest
 * "coming soon" notice instead of pretending to produce a file.
 */
export function DataExportButton() {
  const [noticeShown, setNoticeShown] = useState(false);

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setNoticeShown(true)}
      >
        <Download data-slot="icon" aria-hidden="true" />
        خروجی داده
      </Button>
      {noticeShown ? (
        <p className="text-xs text-muted-foreground">
          خروجی داده به‌زودی در دسترس قرار می‌گیرد.
        </p>
      ) : null}
    </div>
  );
}