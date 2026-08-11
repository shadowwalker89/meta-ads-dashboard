# Meta Ads Dashboard

A PWA reporting dashboard for a Meta Ads agency managing multiple clients across
different admins. Reports real-time campaign performance to both internal admins
and external clients.

See `CLAUDE.md` for AI-assistant working rules, `PROJECT.md` for current phase/status,
and `docs/domain-model.md` for the data model.

## Stack

- **Dashboard**: Next.js 15, React 19, TypeScript, Tailwind CSS v4, shadcn/ui
  (Nova preset, **Radix** primitives — see CLAUDE.md, do not switch to Base UI)
- **Collector**: Node.js + Playwright (persistent browser session, no automated login)
- **Storage**: SQLite now (`packages/database`), Supabase Postgres planned (Phase 2)
- **Monorepo**: pnpm workspaces

## Structure

```
apps/
  dashboard/     Next.js app (currently mock-auth; real Dashboard UI not built yet)
  collector/     Playwright-based data collector for Meta Ads Manager
packages/
  shared/        Domain types + storage-agnostic Repository interfaces
  database/      SQLite implementation of all repositories, migrations, seed
docs/
  domain-model.md   Entity definitions, relationships, ownership
```

## Setup

```bash
pnpm install
```

### Database

```bash
cd packages/database
pnpm run migrate
pnpm run seed                    # 3 packages, 1 super admin, 3 admins, 10 clients
pnpm run create-test-ad-account  # one-off: creates 1 AdAccount for the 1st client
pnpm run test
```

### Dashboard

```bash
cd apps/dashboard
pnpm dev
# → http://localhost:3000/login (mock auth: pick a role, no real password yet)
```

### Collector

One-time manual login (never automated — see CLAUDE.md):

```bash
cd apps/collector
pnpm run bootstrap-session   # opens a real browser window, log into Meta manually
```

Then, in the target Meta Ads Manager account, under **Columns → Customize columns**,
enable: Impressions, Reach, Amount spent, Clicks (all), Link clicks, CTR (all),
CPC (all), CPM. This is a one-time, per-ad-account setting — the Collector's CSV
export depends on it.

Update the AdAccount's real Meta account id (one-off, until an admin UI exists):

```bash
sqlite3 packages/database/data/app.db \
  "UPDATE ad_accounts SET meta_ad_account_id = '<real act id>' WHERE id = '<internal AdAccount id>';"
```

Run the collector:

```bash
pnpm start
```

### Environment variables (`apps/collector`)

| Variable | Default | Purpose |
|---|---|---|
| `COLLECTOR_USER_DATA_DIR` | `./.collector-session` | Persistent browser profile dir (never commit) |
| `COLLECTOR_ADS_MANAGER_BASE_URL` | `https://adsmanager.facebook.com/adsmanager/manage/campaigns` | Real Meta Ads Manager campaigns URL |
| `COLLECTOR_NAVIGATION_TIMEOUT_MS` | `90000` | Meta's UI is slow on small VPS instances |
| `COLLECTOR_TARGET_BASE_URL` | placeholder | Used only by one-off debug scripts (`debug-session`, `debug-export`) |

## Scope note

Iranian clients are explicitly out of scope for this project (Meta sanctions
compliance — see CLAUDE.md).
