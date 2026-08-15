import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLocalizedNumber } from "../src/number-normalizer.js";
import { MetricsParser } from "../src/metrics-parser.js";
import { parseCsv } from "../src/meta-ads-scraper.js";

test("parseLocalizedNumber: English thousands separator", () => {
  assert.equal(parseLocalizedNumber("1,234"), 1234);
});

test("parseLocalizedNumber: Persian thousands separator", () => {
  assert.equal(parseLocalizedNumber("۱٬۲۳۴"), 1234);
});

test("parseLocalizedNumber: English thousands + decimal", () => {
  assert.equal(parseLocalizedNumber("12,345.67"), 12345.67);
});

test("parseLocalizedNumber: Persian thousands + decimal", () => {
  assert.equal(parseLocalizedNumber("۱۲٬۳۴۵٫۶۷"), 12345.67);
});

test("parseLocalizedNumber: USD currency", () => {
  assert.equal(parseLocalizedNumber("$45.00"), 45);
});

test("parseLocalizedNumber: USD currency with thousands", () => {
  assert.equal(parseLocalizedNumber("$1,234.56"), 1234.56);
});

test("parseLocalizedNumber: European currency (comma decimal)", () => {
  assert.equal(parseLocalizedNumber("€45,00"), 45);
});

test("parseLocalizedNumber: European currency (dot thousands, comma decimal)", () => {
  assert.equal(parseLocalizedNumber("€1.234,56"), 1234.56);
});

test("parseLocalizedNumber: plain decimal, no currency", () => {
  assert.equal(parseLocalizedNumber("45.00"), 45);
});

test("parseLocalizedNumber: English percentage", () => {
  assert.equal(parseLocalizedNumber("12.3%"), 12.3);
});

test("parseLocalizedNumber: Persian percentage", () => {
  assert.equal(parseLocalizedNumber("۱۲٫۳٪"), 12.3);
});

test("parseLocalizedNumber: dash returns null", () => {
  assert.equal(parseLocalizedNumber("-"), null);
});

test("parseLocalizedNumber: N/A returns null", () => {
  assert.equal(parseLocalizedNumber("N/A"), null);
});

test("parseLocalizedNumber: empty string returns null", () => {
  assert.equal(parseLocalizedNumber(""), null);
});

test("MetricsParser: converts a full RawCampaignMetrics row", () => {
  const parser = new MetricsParser();
  const result = parser.parse({
    scrapedLabel: "Summer Sale",
    impressions: "۱۲٬۳۴۵",
    clicks: "1,234",
    linkClicks: "987",
    spend: "$1,234.56",
    ctr: "12.3%",
    cpc: "$0.45",
    cpm: "€1.234,56",
    reach: "-",
    frequency: "2.22",
    clicksAll: "1,500",
    uniqueClicks: "1,100",
    uniqueCtr: "10.1%",
    landingPageViews: "800",
    outboundClicks: "700",
    outboundCtr: "8.8%",
    leads: "45",
    messagesStarted: "12",
    messagesContacts: "10",
    results: "45",
    costPerResult: "$27.43",
    postReactions: "300",
    postComments: "25",
  });

  assert.equal(result.impressions, 12345);
  assert.equal(result.clicks, 1234);
  assert.equal(result.linkClicks, 987);
  assert.equal(result.spend, 1234.56);
  assert.equal(result.ctr, 12.3);
  assert.equal(result.cpc, 0.45);
  assert.equal(result.cpm, 1234.56);
  // "-" has no value → parseLocalizedNumber returns null →
  // MetricsParser coerces to 0 (Domain Model field is non-nullable).
  assert.equal(result.reach, 0);
  assert.equal(result.frequency, 2.22);
  assert.equal(result.clicksAll, 1500);
  assert.equal(result.uniqueClicks, 1100);
  assert.equal(result.uniqueCtr, 10.1);
  assert.equal(result.landingPageViews, 800);
  assert.equal(result.outboundClicks, 700);
  assert.equal(result.outboundCtr, 8.8);
  assert.equal(result.leads, 45);
  assert.equal(result.messagesStarted, 12);
  assert.equal(result.messagesContacts, 10);
  assert.equal(result.results, 45);
  assert.equal(result.costPerResult, 27.43);
  assert.equal(result.postReactions, 300);
  assert.equal(result.postComments, 25);
});

test("MetricsParser: parseCsvRow maps a real Meta export row", () => {
  const parser = new MetricsParser();
  const result = parser.parseCsvRow({
    "Campaign name": "Iraq Lead Campaign",
    "Campaign ID": "987654321012345",
    Delivery: "Active",
    Results: "150",
    "Amount spent": "500",
    Impressions: "100000",
    Reach: "45000",
    Frequency: "2.22",
    "Link clicks": "2500",
    "Clicks (all)": "3000",
    "Unique clicks": "2600",
    "CTR (all)": "3",
    "Unique CTR": "2.6",
    "CPC (cost per link click)": "0.2",
    CPM: "5",
    "Landing page views": "1800",
    "Outbound clicks": "1700",
    "Outbound CTR": "1.7",
    Leads: "150",
    "Cost per result": "3.33",
    "Post reactions": "2000",
    "Post comments": "340",
  });

  assert.equal(result.scrapedLabel, "Iraq Lead Campaign");
  assert.equal(result.impressions, 100000);
  assert.equal(result.reach, 45000);
  assert.equal(result.frequency, 2.22);
  assert.equal(result.spend, 500);
  assert.equal(result.clicks, 2500);
  assert.equal(result.clicksAll, 3000);
  assert.equal(result.linkClicks, 2500);
  assert.equal(result.uniqueClicks, 2600);
  assert.equal(result.ctr, 3);
  assert.equal(result.uniqueCtr, 2.6);
  assert.equal(result.cpc, 0.2);
  assert.equal(result.cpm, 5);
  assert.equal(result.landingPageViews, 1800);
  assert.equal(result.outboundClicks, 1700);
  assert.equal(result.outboundCtr, 1.7);
  assert.equal(result.leads, 150);
  assert.equal(result.results, 150);
  assert.equal(result.costPerResult, 3.33);
  assert.equal(result.postReactions, 2000);
  assert.equal(result.postComments, 340);
  // No messaging columns in the export → normalized to 0.
  assert.equal(result.messagesStarted, 0);
  assert.equal(result.messagesContacts, 0);
});

test("MetricsParser: parseCsvRow normalizes header case/space/punctuation", () => {
  const parser = new MetricsParser();
  const result = parser.parseCsvRow({
    "  CAMPAIGN name ": "Normalized Header",
    "amount spent (usd)": "25",
    "CTR ALL": "4.5%",
    "Link  Clicks": "50",
    Clicks: "60",
  });

  assert.equal(result.scrapedLabel, "Normalized Header");
  assert.equal(result.spend, 25);
  assert.equal(result.ctr, 4.5);
  assert.equal(result.clicks, 50);
  assert.equal(result.linkClicks, 50);
  assert.equal(result.clicksAll, 60);
});

test("MetricsParser: parseCsvRow with only a subset of columns", () => {
  const parser = new MetricsParser();
  const result = parser.parseCsvRow({
    "Campaign name": "Partial Row",
    Impressions: "1,000",
  });

  assert.equal(result.scrapedLabel, "Partial Row");
  assert.equal(result.impressions, 1000);
  assert.equal(result.spend, 0);
  assert.equal(result.clicks, 0);
});

test("MetricsParser: parses the real fixture CSV end-to-end", () => {
  const csvPath = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures", "meta-campaign-export.csv");
  const rows = parseCsv(readFileSync(csvPath, "utf-8"));
  assert.ok(rows.length >= 2, "fixture CSV should have a header + at least one row");

  const header = rows[0];
  const dataRow = rows[1];
  const rowObject: Record<string, string> = {};
  for (let i = 0; i < header.length; i++) {
    rowObject[header[i]] = dataRow[i] ?? "";
  }

  const parser = new MetricsParser();
  const result = parser.parseCsvRow(rowObject);

  assert.equal(result.scrapedLabel, "Iraq Lead Campaign");
  assert.equal(result.impressions, 100000);
  assert.equal(result.reach, 45000);
  assert.equal(result.frequency, 2.22);
  assert.equal(result.spend, 500);
  assert.equal(result.clicks, 2500);
  assert.equal(result.clicksAll, 3000);
  assert.equal(result.leads, 150);
  assert.equal(result.landingPageViews, 1800);
});
