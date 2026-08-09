import type { Page } from "playwright";
import { readFileSync } from "node:fs";
import type { RawCampaignMetrics } from "./raw-campaign-metrics.js";

// Meta's own internal instrumentation hook (found directly in the
// real page HTML, Sprint 5 troubleshooting 2026-08-08) -- not a
// generated atomic CSS class, much less likely to change on a
// routine deploy.
const EXPORT_BUTTON_SELECTOR = '[data-surface="/am/table/tool_bar/lib:quick-export-button"]';

// Exact column headers confirmed from a real exported CSV
// (2026-08-08), after enabling Clicks (all), CTR (all), CPC (all),
// CPM, Reach, and Link clicks in Meta's "Customize columns" view.
// Copied verbatim -- not guessed. If Meta renames a column, this map
// is the one place to fix it.
const COLUMN_LABELS = {
  scrapedLabel: "Campaign name",
  impressions: "Impressions",
  clicks: "Clicks (all)",
  linkClicks: "Link clicks",
  spend: "Amount spent (USD)",
  ctr: "CTR (all)",
  cpc: "CPC (all) (USD)",
  cpm: "CPM (cost per 1,000 impressions) (USD)",
  reach: "Reach",
} as const;

/**
 * Minimal RFC4180-ish CSV parser (quoted fields, escaped "" quotes,
 * commas inside quotes). No dependency added for this -- Meta's
 * export is a simple, single-sheet CSV and this is a handful of
 * lines.
 */
function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && content[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/**
 * Switches the table view to "All ads" before exporting. Without
 * this, Meta defaults to a filtered view (e.g. "Active ads") that
 * excludes draft/paused campaigns -- confirmed directly (Sprint 5
 * troubleshooting, 2026-08-09): the export came back "No data
 * available." even though a real draft campaign existed, until this
 * tab was selected. Best-effort: if the tab isn't found (e.g. Meta
 * changes this UI, or a different view is already active), this logs
 * a warning and continues rather than failing the whole job over a
 * view-switch that may not even be necessary in that case.
 */
async function switchToAllAdsView(page: Page): Promise<void> {
  try {
    await page
      .getByRole("link", { name: "All ads", exact: true })
      .first()
      .click({ timeout: 15_000 });
    console.log('[Collector] switched to "All ads" view');
    await page.waitForTimeout(2000);
  } catch {
    console.warn(
      '[Collector] could not find/click the "All ads" tab — continuing with whatever view is currently active'
    );
  }
}

/**
 * Clicks Meta's "Quick export" button, waits for the real file
 * download, and parses it into RawCampaignMetrics rows. Requires the
 * ad account's Campaigns view to already have the columns in
 * COLUMN_LABELS enabled via "Customize columns" (a one-time, per
 * -account setup step -- see project notes) -- if a column is
 * missing, that field is left as an empty string rather than failing
 * the whole row, and MetricsParser will normalize it to 0.
 */
export async function scrapeCampaignTable(
  page: Page,
  downloadTimeoutMs = 90_000
): Promise<RawCampaignMetrics[]> {
  await switchToAllAdsView(page);

  const exportButton = page.locator(EXPORT_BUTTON_SELECTOR);

  if ((await exportButton.count()) === 0) {
    console.warn("[Collector] export button not found on the page — cannot read campaign data");
    return [];
  }

  const downloadPromise = page.waitForEvent("download", { timeout: downloadTimeoutMs });
  await exportButton.first().click();
  console.log("[Collector] export requested, waiting for file...");

  const download = await downloadPromise;
  const filePath = await download.path();

  if (!filePath) {
    console.warn("[Collector] export download did not produce a readable file");
    return [];
  }

  const csvContent = readFileSync(filePath, "utf-8");

  // TEMPORARY diagnostic (Sprint 5 troubleshooting) -- prints exactly
  // what Meta's export actually contained, so a "0 rows found" result
  // can be understood directly from these logs instead of guessing.
  // Safe to remove once row counts look right consistently.
  console.log("[Collector][debug] raw export CSV:");
  console.log(csvContent);

  const rows = parseCsv(csvContent);

  if (rows.length === 0) {
    return [];
  }

  const header = rows[0];
  const columnIndex = (label: string) => header.indexOf(label);

  const indices = {
    scrapedLabel: columnIndex(COLUMN_LABELS.scrapedLabel),
    impressions: columnIndex(COLUMN_LABELS.impressions),
    clicks: columnIndex(COLUMN_LABELS.clicks),
    linkClicks: columnIndex(COLUMN_LABELS.linkClicks),
    spend: columnIndex(COLUMN_LABELS.spend),
    ctr: columnIndex(COLUMN_LABELS.ctr),
    cpc: columnIndex(COLUMN_LABELS.cpc),
    cpm: columnIndex(COLUMN_LABELS.cpm),
    reach: columnIndex(COLUMN_LABELS.reach),
  };

  if (indices.scrapedLabel === -1) {
    console.warn(
      `[Collector] export CSV is missing the "${COLUMN_LABELS.scrapedLabel}" column — check the account's Customize columns setup`
    );
    return [];
  }

  const results: RawCampaignMetrics[] = [];

  for (const row of rows.slice(1)) {
    // Meta prints a literal "No data available." single-column row
    // when the account/date-range has nothing to report -- not an
    // error, just genuinely empty.
    if (row.length === 1 && row[0] === "No data available.") {
      continue;
    }

    const scrapedLabel = row[indices.scrapedLabel];
    if (!scrapedLabel) continue;

    const field = (index: number) => (index >= 0 ? (row[index] ?? "") : "");

    results.push({
      scrapedLabel,
      impressions: field(indices.impressions),
      clicks: field(indices.clicks),
      linkClicks: field(indices.linkClicks),
      spend: field(indices.spend),
      ctr: field(indices.ctr),
      cpc: field(indices.cpc),
      cpm: field(indices.cpm),
      reach: field(indices.reach),
    });
  }

  return results;
}
