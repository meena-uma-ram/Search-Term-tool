# Search Terms Cleaner (MVP)

Connect to Google Ads and manually investigate search terms that may deserve a
negative-keyword review.

- **No AI.** Every classification is a deterministic rule you can read and edit.
- **Read-only.** The app never changes anything in Google Ads. Recommendations
  are only suggestions. "Apply selected negatives to Google Ads" is a disabled
  placeholder for a future version.
- **Works without Google Ads.** With no credentials configured (or before you
  connect), the app serves synthetic demo data through the same API.

## Quick start

```bash
npm install
npm run dev        # backend on :3001, UI on http://localhost:5173 (demo data)
npm test           # rule engine, Google Ads module and API tests
npm run typecheck
```

Production: `npm run build && NODE_ENV=production SESSION_SECRET=... npm start`
(Express serves the built UI from `dist/` on `PORT`, default 3001).

## Workflow

1. Click **Connect Google Ads**. The backend runs the OAuth flow.
2. Pick an account. Direct accounts and accounts under your manager (MCC)
   accounts are listed.
3. Pick a date range (presets or custom) and all campaigns or a subset.
4. Search terms are loaded from `search_term_view` and classified.
5. Filter by **All / Potential negatives / Zero conversions / High cost /
   Brand / Competitor / Informational / Location / Near duplicate**, search,
   and sort.
6. Tick rows, then **Export selected CSV**.

## Rules

| Tag | Rule |
| --- | --- |
| Zero conversions | `conversions === 0` |
| High cost | `cost >= threshold` (default 50, editable) |
| Brand | matches the editable brand list |
| Competitor | matches the editable competitor list |
| Informational | contains a word or phrase from the editable informational list (`how to`, `free`, `jobs`, …) |
| Location | matches the editable location list (`near me`, `nearby`, city names, …) |
| Near duplicate | another search term in the result set has the same or a very similar normalized form |

**Potential negative keyword** (default): `conversions === 0 AND clicks >= 10`,
with the exact reason shown, e.g. `18 clicks · €14.00 spend · 0 conversions`.
The click and conversion thresholds can be changed.

How list matching works: text is lowercased, accents are removed and
punctuation becomes spaces. Entries then match whole words or phrases, so
`art` does not match `smart`.

How near-duplicate detection works: each term gets a canonical key (stop words
removed, light singularization, unique tokens sorted). Two different spellings
are near duplicates when their keys are equal, or when their Levenshtein
similarity is at or above the threshold (default 0.85). The same term repeated
in several ad groups is not counted as a near duplicate.

Rule settings are edited in the **Rules** panel and saved per account in your
browser's localStorage.

## Architecture

```
src/engine/            Rule engine: pure TypeScript, no Google Ads or UI dependencies
  types.ts             SearchTermRow (source-agnostic input), ClassifiedRow, RuleConfig
  normalize.ts         normalization, phrase matching, canonical keys
  nearDuplicate.ts     deterministic grouping (union-find + bounded Levenshtein)
  classify.ts          classifyRows(), recommend(), summarize()
  csv.ts               CSV export (RFC 4180, formula-injection safe)
src/shared/api.ts      JSON contract between backend and browser (no secrets)
src/client/            React UI (Vite)
server/
  app.ts               Express app (security headers, session, routes, static UI)
  config.ts            env config; Google Ads is enabled only if all credentials exist
  session.ts           signed HttpOnly session cookie; tokens kept server-side
  routes/auth.ts       /auth/google/start | callback | disconnect
  routes/api.ts        /api/status, /api/accounts, /campaigns, /search-terms
  providers/types.ts   SearchTermsProvider interface (read-only: no mutate methods)
  providers/googleAds/ all Google Ads code: OAuth, REST client, GAQL, row mapping
  providers/demo/      synthetic, deterministic demo provider
```

The engine takes plain `SearchTermRow[]`. Any future source, such as a CSV
upload, only has to map its rows into that shape.

## Connecting a real Google Ads account

1. In Google Cloud Console, enable the **Google Ads API**. Create an OAuth client
   of type *Web application* and add the redirect URI
   `http://localhost:5173/auth/google/callback`. In production, use your domain
   plus `/auth/google/callback`.
2. Get a developer token from Google Ads > Tools > API Center. A test-level
   token only works with test accounts.
3. Copy `.env.example` to `.env` and fill in `GOOGLE_ADS_CLIENT_ID`,
   `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`, and optionally
   `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (your MCC). Set `SESSION_SECRET` too.
4. Restart `npm run dev` and click **Connect Google Ads**.

The API version is set with `GOOGLE_ADS_API_VERSION` (default `v25`). Google
retires versions about a year after release, so bump it when needed.

## Security notes

- The OAuth client secret, developer token and OAuth tokens exist only on the
  server. The browser gets an opaque signed session cookie (HttpOnly,
  SameSite=Lax, Secure in production). Tests check that API responses and the
  OAuth redirect contain no secrets.
- The OAuth `state` parameter is checked against the session (CSRF). The
  session id is replaced after login. Disconnecting revokes the refresh token.
- GAQL inputs (dates, ids) are validated before they go into a query.
- CSV cells that start with `= + - @` are prefixed with `'` to prevent formula
  injection.
- **MVP limitation:** sessions and tokens are kept in memory. They are lost on
  restart, and the app runs as a single instance only. Before multi-user
  production, move them to a persistent store and encrypt refresh tokens at
  rest.

## Not in this MVP

- Applying negative keywords to Google Ads (button present but disabled)
- CSV import (the engine is ready for it)
- Saved views, user accounts, persistent server-side storage
