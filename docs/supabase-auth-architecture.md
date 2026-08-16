# Supabase Auth Architecture (foundation)

Status: **foundation laid, real Supabase wiring is the deployment phase.**
This document records the boundaries and decisions established in the
auth-boundary work. It does not describe a working Supabase integration
yet — that happens later, without changing any of these contracts.

## The core rule

The dashboard must never know whether authentication comes from the mock
provider or from Supabase. Everything below `apps/dashboard/lib/auth/`
is the only place that knows.

```
Supabase Auth identity                    mock cookie (dev only)
        │                                        │
        ▼                                        ▼
AuthProvider.getSession() ──► AuthIdentity { id, provider }
        │
        ▼
AuthUserMapper.findByAuthId(authId) ──► application User (SQLite today,
                                        Supabase Postgres later)
        │
        ▼
access.ts  (the single authorization boundary — unchanged)
        │
        ▼
future RLS policies in Postgres mirror the exact same rules
```

## Three layers, three files

1. **AuthProvider** (`lib/auth/types.ts`) — sign in / sign out / read the
   current session. The only layer that talks to the auth vendor.
2. **AuthUserMapper** (`lib/auth/types.ts`) — the only bridge between an
   authenticated identity and the application `User`. One per provider.
3. **access.ts** (`lib/access.ts`, unchanged) — takes the resolved
   application `User` and applies role + client-relationship rules:
   `super_admin` → any client, `admin` → assigned clients only,
   `client` → own client only, unauthenticated → rejected.

## Identity vs. application User

- `AuthIdentity.id` is the provider's id: Supabase Auth `user.id`
  long-term, the seeded email as a documented transitional dev bridge.
- **Email is NOT the long-term primary mapping.** The mock mapper maps
  by email because that is the only stable handle the dev seeds expose;
  the Supabase mapper will map by `user.id`.
- Role, client relationship and admin assignments ALWAYS come from the
  application `User` row via the mapper + repositories. They are never
  read from the cookie and never sent to the browser as a claim.
- An identity with no matching `User` row **throws** in
  `resolveCurrentUser()` (`lib/auth/index.ts`) — it never becomes an
  anonymous authorization and never silently looks logged out.

## Tenant relationship (for future RLS)

```
Auth user.id ──► application User ──► role / clientId / admin assignments
                                          │
                                          ▼
                        accessibleClientIds(): the rule RLS will encode
```

The RLS policies planned for the Supabase Postgres swap will encode
exactly `accessibleClientIds()` semantics at the storage layer, so even
raw SQL access from a future server component cannot leak clients the
rule forbids.

## Provider selection (`lib/auth/config.ts`)

Pure function `resolveAuthProviderName(env)` (Edge-safe, imported by
middleware):

| `NODE_ENV`    | `AUTH_PROVIDER`            | Result                     |
| ------------- | -------------------------- | -------------------------- |
| production    | `supabase`                 | `supabase`                 |
| production    | (unset) or `mock`          | **throws** — no silent fallback |
| dev/test      | (unset)                    | `mock` (default)           |
| dev/test      | `mock` / `supabase`        | as given                   |
| any           | anything else              | **throws**                 |

## Mock provider (`lib/auth/mock.ts`, `lib/mock-auth.ts`)

- Dev/test only. The cookie (`mock-session`) holds ONLY `{ userId }` —
  the identity handle. No role, no clientId.
- `signIn` validates the email against the application `User`
  repository, so only seeded accounts can log in; an arbitrary identity
  cannot be asserted.
- `parseMockSession` rejects any cookie with extra claims (tampered).
- The session store is injectable (`MockSessionStore`), so tests use an
  in-memory store and the Next.js request scope uses `cookies()`.

## Supabase provider (`lib/auth/supabase.ts`)

- A deliberately non-functional boundary until the deployment phase.
- Constructor validates `SUPABASE_URL` + `SUPABASE_ANON_KEY` (throws if
  unset). Every method throws "not wired (deployment phase)".
- **Only the anon key** belongs in this browser-safe boundary. The
  service-role key is server-only and must never reach client code.

## Middleware (`middleware.ts`)

- Resolves the provider name via the pure config function (try/catch;
  unparseable config fails open at the edge — `access.ts` fails closed).
- Mock provider: cookie-presence redirect for `/dashboard/*`.
- Supabase provider: **no fake implementation** here. Real session
  validation/refresh lands with `@supabase/ssr` during deployment.

## Dynamic rendering (required)

Auth-scoped routes resolve the user from a request cookie and read the
provider config, so they must never be statically prerendered — the
strict production guard would fire during `next build` (NODE_ENV=production
with no AUTH_PROVIDER set). The following route files therefore declare
`export const dynamic = "force-dynamic"`:

- `app/page.tsx` (root redirect)
- `app/login/page.tsx`
- `app/(dashboard)/layout.tsx` (covers every dashboard page)

Any future auth-scoped page must either live under `(dashboard)` or add
the same export. The guard itself is unchanged and still strict for real
requests in production.

## What was NOT changed

- `access.ts` semantics (client own / admin assigned / super_admin all).
- PricingRule calculation, Package model, InsightSnapshot, raw Meta
  data, the Collector, collection scheduling, audit semantics.

## Environment

See `.env.example` (placeholders only — no credentials in the repo):

```
AUTH_PROVIDER=mock            # dev/test default; must be "supabase" in production
SUPABASE_URL=
SUPABASE_ANON_KEY=
```