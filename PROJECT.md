# PROJECT.md — Status Tracking

Last updated: 2026-08-17 (Phase 2B Step 1 reporting-window evidence)

For working rules and architectural constraints, see `CLAUDE.md`.
For the data model, see `docs/domain-model.md`.

## Phase status

| Phase | Status |
|---|---|
| 1 — Collector + storage foundation | Substantially complete |
| 2 — Real Dashboard (Supabase Auth, Admin/Client panels) | **Not started — current phase** |
| 3 — Meta Marketing API (replaces Playwright) | Not started |
| 4 — WhatsApp chatbot (separate future phase) | Deferred, not started, no Domain Model yet |

## Phase 2B Step 1 — reporting-window evidence (audit conclusion)

Live evidence gathered via the existing persistent Playwright session and the
existing verified CSV export mechanism (test account, Draft campaign only):

1. **CSV reporting-window columns are CONFIRMED to exist** — a real Meta CSV
   export was successfully produced through the existing session using the
   existing verified export selector.
2. **Exact header names are CONFIRMED**: `Reporting starts` and `Reporting ends`.
3. **Values are confirmed to come directly from Meta's CSV stream** — read
   verbatim from the export with no transformation.
4. **Actual date values and date format remain UNVERIFIED** — the test account has
   no running campaign / no payment method, so the export correctly returns
   "No data available." and no real row could be observed. This is expected, not a
   collector/session failure, and must not be diagnosed as auth/filter trouble.
5. **Migration 008 is technically justified** as the next architectural step
   (columns exist with stable names), but implementation is **postponed** until at
   least one real campaign row can be observed OR the exact date serialization is
   established safely.
6. **Do not fabricate or infer the date format** — no code writes/reads these
   columns until point 4 is resolved.

Artifacts: temporary observational script `apps/collector/src/debug-export-window.ts`
and its `debug-export-window` npm entry in `apps/collector/package.json` (cleanup
pending owner decision — see Pending work).

## What's implemented

- Monorepo: `apps/dashboard`, `apps/collector`, `packages/shared`, `packages/database`
- Dashboard shell: Next.js 15 App Router, RTL/Persian, dark mode, shadcn/ui (Nova
  preset, Radix), sidebar + topbar + mobile nav — all cosmetic/layout only
- Mock authentication: cookie-based, 3 roles (`super_admin`/`admin`/`client`),
  route-protecting middleware — **temporary**, will be replaced by Supabase Auth
- Domain Model: 10 entities (`docs/domain-model.md`) — User, Client, Package,
  AdminAssignment, AdAccount, Campaign, InsightSnapshot, DashboardPreference,
  AuditLog, CollectorJob
- Repository interfaces (`packages/shared/src/domain/repositories/`) — one per
  entity, storage-agnostic, cursor-based pagination
- SQLite implementation (`packages/database`) — migrations (`001_init.sql`,
  `002_add_link_clicks.sql`), seed script, one-off `create-test-ad-account.ts`,
  smoke + repository tests, all passing
- Real Collector (`apps/collector`):
  - `BrowserSessionManager` — Playwright `launchPersistentContext`, one context
    per run, manual one-time login via `bootstrap-session.ts`
  - `isSessionLoggedIn()` — checks for the sidebar "Campaigns" text (a `<div>`,
    not a link — corrected from an earlier wrong guess)
  - `scrapeCampaignTable()` — clicks Meta's "Quick export" button
    (`data-surface="/am/table/tool_bar/lib:quick-export-button"`), waits for the
    real file download, parses the CSV (custom lightweight parser, no dependency)
  - Confirmed real CSV column mapping (see `COLUMN_LABELS` in
    `meta-ads-scraper.ts`) — includes both `Clicks (all)` and `Link clicks`
  - `MetricsParser` / `parseLocalizedNumber()` — handles Persian + English digits,
    thousands/decimal separators (both `,`/`.` orderings), currency symbols,
    percentages, empty markers (`-`, `N/A`, ``) → unit-tested (15 cases)
  - `CollectorOrchestrator` — Campaign Discovery (find-or-create by
    `scrapedLabel` via `CampaignRepository.findByAdAccountAndLabel`, added this
    sprint), saves `InsightSnapshot` rows, tracks `CollectorJob` lifecycle
  - Fixed real bug: session-not-logged-in used to silently report
    `CollectorJob.status = "success"`; now throws so it's correctly `"failed"`
  - Fixed real bug: Ad Account URL was built with an invented REST-style path;
    now correctly uses Meta's real `?act=<metaAdAccountId>` format

## What's NOT implemented

- Real Dashboard UI: no charts, no Admin panel (client/package/ad-account
  management), no Client panel — all still placeholder pages
- Supabase Auth/Realtime/RBAC
- Any way to create/manage AdAccounts except the one-off script or raw SQL
- Cron/scheduling for periodic Collector runs (currently manual `pnpm start`)
- WhatsApp chatbot (fully separate future phase)
- Full-pipeline verification with a real, non-zero metrics row (see Known Issues)

## Known issues / open items

1. **Full pipeline unverified with real non-zero data.** Only tested against a
   real logged-in session + a draft/zero-delivery campaign (correctly produced
   "No data available", handled without crashing). `MetricsParser`'s numeric
   parsing is unit-tested against synthetic strings only. Blocked on the project
   owner having a spending campaign available (no credit card on the account yet
   as of last update).
2. **"All ads" tab-click currently fails/warns every run** in
   `switchToAllAdsView()` (`meta-ads-scraper.ts`). Turned out NOT to be the cause
   of the "No data available" result (that was genuinely zero-delivery data, not
   a filtered-out draft) — function fails open and doesn't block the job, but the
   selector itself should be re-verified against real DOM evidence before relying
   on it for accounts with a mix of active/paused/draft campaigns.
3. **Temporary diagnostic logging** of the full raw export CSV content is still
   in `scrapeCampaignTable()` — verbose, and could print real campaign data to
   logs. Remove once real-data testing (#1) is confirmed working.
4. **`AdAccount.metaAdAccountId`** for the one existing test AdAccount was set via
   a direct `sqlite3 UPDATE`, not through application code — no admin UI or script
   exists yet for this.

## Pending work (priority order)

1. Decide UI template for Dashboard (owner leans TailAdmin; present alternatives)
2. Build real Dashboard: Admin panel (Client/Package/AdAccount management) +
   Client panel (charts/KPIs) — decide Supabase Auth timing relative to this
3. Validate full Collector pipeline against a real spending campaign; remove
   temporary debug logging afterward
4. Fix/verify the "All ads" tab-click selector with real DOM evidence
5. Build an admin-facing way to create/manage AdAccounts
6. Add scheduling (cron) for periodic automated Collector runs
7. (Separate phase) WhatsApp Business Cloud API chatbot — own Domain Model + plan

## Verification commands

```bash
# Database
cd packages/database
pnpm run migrate
pnpm run seed
pnpm run test          # smoke.test.ts + campaign-repository.test.ts

# Collector
cd apps/collector
pnpm run test          # metrics-parser.test.ts (15 unit tests)
pnpm run bootstrap-session   # one-time manual login, headful
pnpm start                   # real end-to-end run
```

All of the above currently pass except the "All ads" tab click (non-blocking
warning) and the untested real-non-zero-data path (see Known Issues #1-2).
