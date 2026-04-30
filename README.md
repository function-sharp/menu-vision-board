# Col'Cacchio Menu & Insights Dashboard

> Internal operations dashboard for the Col'Cacchio Italian restaurant chain. One place to browse every store's menu, compare item pricing, monitor Google reviews, manage promotions, and run scraping/sync jobs.

- **Preview**: https://id-preview--6161f505-ad91-4918-a913-ba51753ff597.lovable.app
- **Published**: https://menu-vision-board.lovable.app
- **Custom domains**: https://storeinsightshub.com · https://www.storeinsightshub.com
- **Lovable project ID**: `6161f505-ad91-4918-a913-ba51753ff597`

---

## 1. Tech stack

| Layer | Tools |
|---|---|
| UI | React 18, Vite 5, TypeScript 5 |
| Styling | Tailwind v3 (HSL semantic tokens in `src/index.css` + `tailwind.config.ts`), shadcn/ui (Radix primitives), `lucide-react` icons |
| Data / state | TanStack Query v5, React Router v6 |
| Charts | Recharts |
| Notifications | Sonner |
| Reports | `jspdf` + `html2canvas` (client-side PDF) |
| Spreadsheets | `xlsx` (client-side parsing for upload) |
| Backend | **Lovable Cloud** (managed Supabase) — Postgres + Auth + Edge Functions (Deno) |
| AI | Lovable AI Gateway (`google/gemini-2.5-flash` for review analysis) |
| External APIs | Apify (Google reviews dataset), Firecrawl (Uber Eats scraping), Airtable (promotions) |

Tests: Vitest + Testing Library (only a scaffold today). Linting: ESLint flat config.

---

## 2. App routes

Registered in `src/App.tsx`. All routes except `/auth` are wrapped by `AuthGuard` → `AppLayout` (sidebar + header).

| Path | Page | Purpose |
|---|---|---|
| `/auth` | `Auth` | Email/password sign-in + sign-up |
| `/` | `Overview` | Top-level KPIs, items per store, top categories, price distribution, top-rated stores, **Reviews pulse** mini-card |
| `/stores` | `Stores` | Searchable card grid of every store |
| `/stores-overview` | `StoresOverview` | Sortable per-store table — items, categories, price min/avg/max, % of items with Uber Eats deep links, Google rating |
| `/stores/:slug` | `StoreDetail` | Store header, grouped menu (accordion), **Reviews tab** with trend / star-distribution / sentiment charts and **PDF export** |
| `/menu` | `MenuBrowser` | Paginated item table, quick + saved filter presets (DB-backed), CSV export, item detail dialog |
| `/compare` | `ItemComparison` | Search an item name, see its price spread across all stores |
| `/analytics` | `Analytics` | Categories & pricing analytics |
| `/promotions` | `Promotions` | Read-only mirror of the Airtable Promotion Tracker |
| `/reviews` | `Reviews` | Hub: tabs for Overview, Stores, Reviews list, AI Insights, Manage Links. Includes the multi-store `ComparisonPanel` (PDF export) |
| `/uber-eats` | `UberEats` | Uber Eats integration hub |
| `/upload` | `Upload` | Parse `.xlsx` client-side, send rows to `merge-excel` edge function |
| `/activity` | `ActivityLog` | Audit feed from `activity_log` |

A global ⌘K palette (`src/components/GlobalSearch.tsx`) searches stores, items, and reviews.

---

## 3. Backend (Lovable Cloud / Supabase)

### Auth
Email/password via Supabase Auth. `AuthProvider` (`src/hooks/useAuth.tsx`) sets up the session listener first, then loads the existing session. `AuthGuard` redirects unauthenticated users to `/auth`. **There is no role table yet** — every authenticated user has full access. If RBAC is ever needed, add a `user_roles` enum table with a `has_role(uuid, app_role)` SECURITY DEFINER function (see Lovable's user-roles guidance).

### Tables

All tables enable RLS. Public app reads are gated to `authenticated`. Mutations are limited to what the UI actually needs; ingestion tables are written only by edge functions using the service role.

| Table | Purpose | Notes |
|---|---|---|
| `stores` | Master list of physical stores | `slug` is the URL key. Group/cuisine/rating/etc. populated from Excel + Firecrawl + Airtable |
| `menu_items` | All items per store | `deep_link` = item-level Uber Eats URL; `manually_edited_at` protects manual values from being overwritten |
| `menu_filter_presets` | Saved Menu Browser filter sets | Full CRUD for authenticated users |
| `google_places` | One row per Google Maps place ID | `store_id` auto-populated by trigger (see DB functions below) |
| `google_reviews` | Individual Google reviews | `review_id` is the upsert key |
| `review_insights` | AI-generated summaries per `(store_id, period)` | Cached for 24h by `analyze-reviews` |
| `promotions` | Mirrored from Airtable Promotion Tracker | `airtable_id` is the upsert key |
| `uploads` | Audit row per Excel/Airtable upload | Counts + free-form note |
| `sync_runs` | Per-run record for every sync edge function | `direction`, `source`, `status`, `summary`, `error` |
| `scrape_jobs` | Per-action record for `scrape-uber-eats` | `target_type` is `store` or `item` |
| `activity_log` | Generic audit trail | Insert-only from the client; no update/delete |

### Database functions & triggers

Defined in migrations and shown in `<supabase-configuration>`:

- `match_store_for_place_title(text) → uuid` — fuzzy-matches strings like *"Col'Cacchio GO Montecasino"* to a `stores.id` by first-word match, then substring.
- `google_places_set_store` (BEFORE INSERT on `google_places`) — auto-fills `store_id` using the matcher.
- `google_places_propagate_store` (AFTER UPDATE on `google_places`) — propagates a manual store re-link down to all `google_reviews` for that place.
- `google_reviews_set_store` (BEFORE INSERT on `google_reviews`) — copies the place's `store_id` onto the review.

> The combination above means an operator can fix a wrong link in the Reviews → Manage Links tab and every historical review re-links automatically.

### Configured secrets
`APIFY_TOKEN`, `FIRECRAWL_API_KEY` (managed by connector), `AIRTABLE_API_KEY` (managed by connector), `LOVABLE_API_KEY`, plus the standard Supabase keys.

### Storage
None configured. No file uploads / image hosting at this time.

---

## 4. Edge functions (`supabase/functions/`)

All written in Deno, deploy automatically.

### `sync-google-reviews`
Pulls the fixed Apify dataset `bg5J0WsBCpIhuxNDp` (Google Maps reviews), upserts `google_places` and `google_reviews` in 500-row chunks, links each to a store via `match_store_for_place_title`, records a `sync_runs` row and an `activity_log` entry. Triggered manually from the Reviews hub "Sync from Google" button.

### `scrape-uber-eats`
Firecrawl-powered. Body: `{ action, payload, provider }`.

| Action | What it does |
|---|---|
| `find_store_url` | Firecrawl Search for "{name} {address} site:ubereats.com", extracts the first `ubereats.com/.../store/...` URL, writes it to `stores.uber_eats_url`. |
| `scrape_store_metadata` | Firecrawl Scrape with a JSON schema → fills `rating`, `rating_count`, `price_range`, `address`, `cuisine` (NULL-only — `manually_edited_at` is bumped). |
| `scrape_item_links` | Scrapes the store page for links, fuzzy-matches each missing `menu_items.deep_link` by name token containment. |
| `validate_url` | Re-scrapes a stored URL, checks status + presence of meaningful name tokens in markdown/URL slug. |

Every call inserts a `scrape_jobs` row (`running` → `success`/`error`). The `apify` provider is stubbed (`501`).

### `sync-airtable`
Bidirectional sync with Airtable base `appGQEVbE8o5NRK1K` (table `Stores`, table `Promotion Tracker`) via the Lovable connector gateway (`https://connector-gateway.lovable.dev/airtable`).

- `direction: "pull"` — fills NULL `stores.uber_eats_url` from Airtable; full upsert + delete on `promotions` (Airtable owns that table).
- `direction: "push"` — writes Supabase store URLs back into Airtable.

Name matching uses a `normaliseName` helper that strips accents, "Col'Cacchio", "GO", punctuation. Each run logs to `uploads` + `sync_runs`.

### `analyze-reviews`
Calls the Lovable AI Gateway with `google/gemini-2.5-flash` and a strict tool-call schema (`report_review_insights`) to produce:

- 2–3 sentence executive `summary`
- `themes_positive` / `themes_negative` (3–6 each, with example quote + `review_id`)
- `action_items` (3–5, with priority low/medium/high)

Sample size capped at 150 reviews, period one of `7d | 30d | 90d | 12m | all`. Results cached 24h in `review_insights`.

### `merge-excel`
Receives client-parsed xlsx rows from `/upload`. Performs a **NULL-only merge** on stores and items so manual edits are never clobbered. Writes summary rows to `uploads` and `sync_runs`.

---

## 5. Cross-cutting building blocks

| File | Role |
|---|---|
| `src/hooks/useDashboardData.ts` | Stores, items, uploads, promotions queries. `useAllItems` chunks past Postgres' 1000-row limit. |
| `src/hooks/useReviews.ts` | Reviews + places queries, monthly trend, star-distribution trend, response performance, AI insights, manual place→store remap, ⌘K review search. Aggregations computed client-side from up to 50k rows. |
| `src/hooks/useScrape.ts` | Wraps `scrape-uber-eats` with Sonner toasts and `activity_log` writes. |
| `src/hooks/useAuth.tsx` | `AuthProvider` + `useAuth` hook. |
| `src/lib/reviewKpis.ts` | **Canonical KPI math** shared between single-store and comparison PDF exports — volume-weighted aggregates so a row labelled "Reply rate" or "Average rating" means the same thing in both reports. |
| `src/lib/pdfReport.ts` | jsPDF report layout: vector-drawn KPI summary table at the top + html2canvas-rasterised chart sections beneath, paginated. Exports `fmtInt`, `fmtDecimal`, `fmtRating`, `fmtPctFromFraction`, `formatRangeWindow` helpers. |
| `src/lib/activityLog.ts` | Fire-and-forget audit insert. |
| `src/lib/format.ts` | `formatZAR`, `decodeText` (HTML-entity decode for menu text). |
| `src/components/GlobalSearch.tsx` | ⌘K command palette across stores, items, and reviews. |
| `src/components/AppSidebar.tsx` | Single source of truth for left-nav items. |
| `src/components/AuthGuard.tsx` | Wraps protected routes. |

---

## 6. Conventions & gotchas

- **Design tokens only** — never hard-code colors. All colors are HSL semantic tokens defined in `src/index.css` and `tailwind.config.ts` (`primary`, `primary-glow`, `accent`, `muted`, `border`, `card`, etc.).
- **Auto-generated files — never edit:** `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`, `.env`, and the `project_id` line in `supabase/config.toml`.
- **Postgres 1000-row limit** is real. Anywhere we need more rows we paginate with a manual `range(from, from+pageSize-1)` loop until an empty page is returned.
- **Currency**: ZAR throughout. Prices stored as `numeric`.
- **TanStack Query**: keys are plain arrays starting with the entity name (`["stores"]`, `["google-reviews", filters]`). Mutations invalidate by key prefix.
- **PDF reports**: keep the top KPI table in vector jsPDF primitives and only the chart area in html2canvas — preserves crispness and pagination. Single-store and comparison reports must funnel through `reviewKpis.ts`.
- **NULL-only merges** in `merge-excel` and `sync-airtable` pull mean Supabase always wins for any field that is already populated.

---

## 7. Status — what's built vs. what needs work

### ✅ Solid / shipped
- Auth gate, sidebar, ⌘K global search
- Excel → Supabase ingest with NULL-only merge
- Menu Browser with saved filter presets, CSV export, item dialog
- Stores Overview sortable table with link-coverage bar
- Item price comparison across stores
- Google review ingestion (Apify) with auto store-linking trigger
- Review trend / star distribution / sentiment charts
- AI insights (Gemini 2.5 Flash) with structured tool-call output and 24h cache
- PDF export for single-store and multi-store comparison with shared KPI math, formatted timeframe row, monospaced right-aligned numbers
- Airtable promotions sync (pull + push)
- Firecrawl-powered Uber Eats URL discovery, metadata enrichment, item-link fuzzy matching, URL validation
- Audit trails: `activity_log`, `sync_runs`, `scrape_jobs`, `uploads`

### 🚧 Known gaps / opportunities
- **No RBAC** — single-tier authenticated access. Add `user_roles` + `has_role()` if multi-tenant or finer permissions are ever required.
- **Email confirmation policy** is undocumented — verify whether auto-confirm matches what ops want.
- **`useReviewStats` aggregates client-side** (up to 50k rows). The `review_store_stats` view already exists for the per-store case — consider a similar view for global/multi-store stats to push work to Postgres.
- **Apify scrape provider** in `scrape-uber-eats` is stubbed (`501`). Only `firecrawl` works today.
- **No scheduling** — `sync-google-reviews` and `sync-airtable` run manually. Add a `pg_cron` schedule or a Lovable Cloud trigger when ops want hands-off sync.
- **Tests are a scaffold only** (`src/test/example.test.ts`). No coverage of the KPI library, edge functions, or critical hooks.
- **No storage buckets** — image uploads (store logos, response screenshots, etc.) are not supported.
- **`Analytics`, `UberEats`, and `Promotions` pages** are functional but not deeply documented here — read the source when extending them so the README stays accurate.

---

## 8. Local development

```bash
bun install
bun run dev          # http://localhost:8080
bun run test         # vitest run
bun run test:watch
```

> Don't run `bun run build` / `tsc` manually — the Lovable harness handles builds and typechecks on every change.

Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) are auto-injected into `.env` by Lovable Cloud.

---

## 9. Adding new features — quick map

| Need | Where it goes |
|---|---|
| New page | `src/pages/Foo.tsx` → register in `src/App.tsx` and `src/components/AppSidebar.tsx` |
| New shared UI | `src/components/` (group by domain, e.g. `reviews/`) |
| New data hook | `src/hooks/useFoo.ts` — wrap with TanStack Query, key prefix matches the domain |
| New DB table / column | Database migration tool — never hand-edit `types.ts` |
| New backend logic | New folder under `supabase/functions/<name>/index.ts` (Deno). Will auto-deploy. |
| New external integration | Check connectors first (Airtable / Firecrawl pattern), then secrets |
| New AI capability | Use the Lovable AI Gateway with a supported model; never ask the user for a key |

When in doubt, follow the patterns already established by the Reviews hub — it exercises every layer (queries, edge functions, AI Gateway, PDF export, shared KPI library).
