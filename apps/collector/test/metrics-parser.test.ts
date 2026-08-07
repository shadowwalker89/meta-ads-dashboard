import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLocalizedNumber } from "../src/number-normalizer.js";
import { MetricsParser } from "../src/metrics-parser.js";

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
    spend: "$1,234.56",
    ctr: "12.3%",
    cpc: "$0.45",
    cpm: "€1.234,56",
    reach: "-",
  });

  assert.equal(result.impressions, 12345);
  assert.equal(result.clicks, 1234);
  assert.equal(result.spend, 1234.56);
  assert.equal(result.ctr, 12.3);
  assert.equal(result.cpc, 0.45);
  assert.equal(result.cpm, 1234.56);
  // "-" has no value → parseLocalizedNumber returns null →
  // MetricsParser coerces to 0 (Domain Model field is non-nullable).
  assert.equal(result.reach, 0);
});
