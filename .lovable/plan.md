# Plan: Write a comprehensive `README.md`

I'll replace the current placeholder `README.md` with a detailed, single-source-of-truth document covering everything an AI agent or new developer needs to continue building this app. No code changes elsewhere.

## What the README will contain

### 1. Product overview
- **Name**: Col'Cacchio Menu & Insights Dashboard ("Store Insights Hub")
- **Purpose**: Internal ops dashboard for an Italian restaurant chain — central place to browse menus across all stores, compare item pricing, monitor Google reviews, manage promotions, and run scraping/sync jobs.
- **Live URLs**: preview, published (`menu-vision-board.lovable.app`), custom domain (`storeinsightshub.com`).

### 2. Tech stack
React 18 + Vite 5 + TypeScript 5, Tailwind v3 + shadcn/ui (Radix), TanStack Query v5, React Router v6, Recharts, Sonner toasts, jsPDF + html2canvas (client-side PDF), xlsx (client-side Excel parsing), Supabase JS v2, Lovable Cloud (Supabase backend) with Deno edge functions.

### 3. Backend (Lovable Cloud / Supabase)
- **Auth**: email/password via Supabase Auth. `AuthProvider` + `AuthGuard` gate every route except `/auth`. No role table yet (single-tenant internal app).
- **Tables** (with purpose + RLS summary):
  - `stores`, `menu_items`, `menu_filter_presets` — menu catalogue + saved filters
  - `google_places`, `google_reviews`, `review_insights` — review ingestion + AI summaries
  - `promotions` — synced from Airtable
  - `uploads`, `sync_runs`, `scrape_jobs`, `activity_log` — job/audit history
  - All tables: authenticated read; CRUD policies vary (menu_filter_presets fully open to authenticated; google_* read-only from app, written only by edge functions via service role).
- **DB functions / triggers**: `match_store_for_place_title` + `google_places_set_store` / `google_places_propagate_store` / `google_reviews_set_store` auto-link Google places to stores by fuzzy-matching titles like "Col'Cacchio Montecasino".
- **Secrets configured**: `APIFY_TOKEN`, `FIRECRAWL_API_KEY`, `AIRTABLE_API_KEY`, `LOVABLE_API_KEY`, plus Supabase service keys.

### 4. Edge functions (`supabase/functions/`)
- `sync-google-reviews` — pulls a fixed Apify dataset (`bg5J0WsBCpIhuxNDp`) of Google Maps reviews, upserts `google_places` + `google_reviews`, logs to `sync_runs` + `activity_log`.
- `scrape-uber-eats` — Firecrawl-powered. Actions: `find_store_url` (search), `scrape_store_metadata` (rating/price), `scrape_item_links` (fuzzy-match menu items to Uber Eats deep links), `validate_url`. Results recorded in `scrape_jobs`.
- `sync-airtable` — bidirectional sync with Airtable base `appGQEVbE8o5NRK1K` via Lovable connector gateway. PULL fills NULL store URLs + full upsert/delete on promotions; PUSH writes Supabase URLs back.
- `analyze-reviews` — calls Lovable AI Gateway (`google/gemini-2.5-flash`) with structured tool-call schema to produce `summary`, positive/negative themes, action items per period (7d/30d/90d/12m/all). 24h cache.
- `merge-excel` — receives parsed xlsx rows from `Upload` page; NULL-only merge on stores + items so manual edits aren't clobbered.

### 5. App routes / features
For each route I'll describe what it does and current state:
- `/auth` — email/password sign-in + sign-up
- `/` Overview — KPIs, items per store, top categories, price distribution, top-rated stores, Reviews pulse mini-card
- `/stores` Stores grid — searchable cards
- `/stores-overview` Stores Overview — sortable per-store table with item/category counts, price stats, Uber-Eats link coverage %, Google rating
- `/stores/:slug` StoreDetail — store header, menu (grouped accordion), Reviews tab with trend charts (volume+avg, star distribution, sentiment) and PDF export
- `/menu` MenuBrowser — paginated table, filter chips, save/load presets to DB, CSV export, item detail dialog
- `/compare` ItemComparison — search an item name, see price spread across stores
- `/analytics` Categories & Pricing
- `/promotions` Promotions (Airtable mirror)
- `/reviews` Reviews hub — Tabs: Overview, Stores, Reviews list, AI Insights, Manage Links. Includes multi-store ComparisonPanel with PDF export.
- `/uber-eats` Uber Eats hub
- `/upload` Data Upload — xlsx parsed client-side, sent to `merge-excel`
- `/activity` ActivityLog — audit trail

### 6. Cross-cutting building blocks
- `src/hooks/useDashboardData.ts` — stores/items queries (chunked >1000)
- `src/hooks/useReviews.ts` — review queries, trend, star-trend, response perf, AI insights, manual place→store re-mapping
- `src/hooks/useScrape.ts` — wraps Firecrawl edge fn with toast + activity log
- `src/lib/reviewKpis.ts` — canonical KPI math shared by single-store and comparison PDFs (volume-weighted aggregates)
- `src/lib/pdfReport.ts` — jsPDF report layout (KPI summary table + html2canvas chart capture, paginated)
- `src/lib/activityLog.ts` — fire-and-forget audit insert
- `src/lib/format.ts` — `formatZAR`, `decodeText`
- `src/components/GlobalSearch.tsx` — ⌘K palette across stores/items/reviews

### 7. Conventions / things to know
- All TanStack queries use plain key arrays; mutations invalidate by prefix.
- Supabase types are auto-generated — never edit `src/integrations/supabase/types.ts`, `client.ts`, `.env`, or `supabase/config.toml` project_id.
- 1000-row Postgres limit handled via manual chunking loops where needed.
- ZAR is the assumed currency throughout; prices stored as `numeric`.
- Per recent PDF work: PDFs use vector-drawn KPI table at the top + html2canvas-rasterised chart sections beneath. Single-store and comparison reports must produce the same KPI wording/math via `reviewKpis.ts`.

### 8. Built vs. needs-work

**Solid / shipped**
- Auth gate, sidebar, global search
- Menu ingestion (Excel merge), browser, presets, CSV export
- Store + item comparison views
- Google review ingestion, trend/distribution/sentiment charts, AI insights with caching
- PDF export (single store + multi-store comparison) with shared KPI calculations
- Airtable promotions sync
- Firecrawl scraping for Uber Eats URLs + item deep-link fuzzy matching
- Activity log + sync_runs audit trail

**Known gaps / opportunities**
- `README.md` is a placeholder (this plan fixes it).
- No user roles / RBAC — every authenticated user has full access. Add `user_roles` + `has_role()` if multi-tenant or finer permissions become needed.
- Email confirmations: behaviour not documented; verify auto-confirm setting matches policy.
- `useReviewStats` pulls up to 50k rows client-side for aggregation — fine today but should move to a server-side view (a `review_store_stats` view is already referenced; consider doing same for global stats).
- `scrape-uber-eats` only supports the `firecrawl` provider; Apify provider stubbed (`501`).
- No automated scheduling for `sync-google-reviews` / `sync-airtable` — currently manual.
- No tests beyond the example.test.ts scaffold.
- No storage buckets configured — image uploads (e.g. store logos) not supported.
- `Analytics`, `UberEats`, `Promotions`, `ActivityLog` pages exist but aren't covered in detail by this exploration; the README will note them as "see source" rather than risk inaccuracies.

### 9. Local dev cheatsheet
- Install: `bun install` (or npm)
- Run: `bun run dev`
- Tests: `bun run test`
- Build is handled by Lovable; do not run manually.
- Env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) auto-injected.

### 10. Where to add new features
Quick guide: new page → `src/pages/`, register in `src/App.tsx` and `src/components/AppSidebar.tsx`. New backend logic → new folder under `supabase/functions/`. New table → migration tool (never hand-edit `types.ts`).

## Files touched
- `README.md` — overwrite with the document above.

No other files change. No dependencies added. No DB migrations needed.
