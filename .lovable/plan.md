# Col'Cacchio Dashboard — Full Audit & Fix Plan

## 1. What's working today

### Auth & access control
- Passwordless magic-link sign-in on `/auth`, locked to `@colcacchio.co.za`.
- `AuthGuard` redirects unauthenticated users; session listener wired correctly in `useAuth`.
- `user_roles` table + `has_role()` SECURITY DEFINER function in place.
- 2 admins seeded (`jason@jslabs.xyz`, `jason@colcacchio.co.za`) via `grant_admin_to_seed_emails` trigger.
- `/admin/users` page and `admin-users` edge function for create / ban / reset / role toggle.
- All public tables have RLS, restricted to `authenticated`.

### Data in the database
| Table | Rows | Notes |
|---|---|---|
| stores | 24 | 100% have `uber_eats_url` + rating |
| menu_items | 2,780 | **0 have `deep_link`** ⚠️ |
| google_places | 25 | 1 unlinked (Northcliff) |
| google_reviews | 28,084 | 1,436 unlinked (all Northcliff), 24,962 with replies |
| promotions | 72 | Airtable pull working |
| sync_runs | 8 | Airtable pull ×6, push ×1, Apify reviews ×1 — all success |
| scrape_jobs | 228 | 219 success / 9 error |
| review_insights | 1 | AI cache populated |
| activity_log | 6 | Light usage |

### Pages confirmed wired in `App.tsx`
`/`, `/stores`, `/stores-overview`, `/stores/:slug`, `/menu`, `/compare`, `/analytics`, `/promotions`, `/uber-eats`, `/upload`, `/activity`, `/reviews`, `/admin/users`, `/auth`, 404.

### Edge functions deployed
`admin-users`, `analyze-reviews`, `merge-excel`, `scrape-uber-eats`, `sync-airtable`, `sync-google-reviews`.

### Shipped features (per README + code)
- ⌘K global search • Excel ingest with NULL-only merge • Saved menu filter presets • CSV export • Sortable stores overview • Item price comparison • Review trend / star-distribution / sentiment charts • AI insights (Gemini 2.5 Flash, 24h cache) • Multi-store comparison PDF • Airtable promotions sync (pull + push) • Firecrawl Uber Eats URL discovery / metadata / item-link matching / URL validation • Audit trails.

---

## 2. Issues found (prioritized)

### P0 — Broken / blocking
1. **Menu items missing Uber Eats deep links.** 0 of 2,780 `menu_items.deep_link` populated, even though every store has an `uber_eats_url`. The `scrape_item_links` action should backfill these — needs investigation (likely the 9 scrape errors below).
2. **Firecrawl connector returning 404 `connector_not_found`.** Multiple recent `scrape_jobs` failed with this. Connector likely disconnected or expired — blocks all Uber Eats scraping.
3. **Northcliff reviews unlinked.** 1,436 reviews (5% of all reviews) attached to a `google_places` row whose `store_id` is NULL because "Northcliff" doesn't match any store name. Either Northcliff is missing from `stores`, or the matcher needs a manual remap via Reviews → Manage Links.

### P1 — Functional gaps
4. **Sidebar admin section.** Verify `/admin/users` is reachable from the sidebar (it should be gated by `useIsAdmin`).
5. **Magic-link email branding.** Auth emails still use the default Supabase template / sender. Consider Lovable Email + custom domain.
6. **Apify provider stubbed in `scrape-uber-eats`.** Returns 501 — only Firecrawl works. Decide whether to remove the toggle or wire it.
7. **No scheduling.** `sync-google-reviews` and `sync-airtable` run manually only. Add pg_cron or a Lovable Cloud schedule.

### P2 — Quality / hardening
8. **Client-side review aggregation** (`useReviewStats`) processes up to 50k rows in-browser. Push to Postgres via a view similar to `review_store_stats`.
9. **Test coverage is a scaffold only.** No tests for `reviewKpis.ts`, edge functions, hooks.
10. **React Router v7 deprecation warnings** in console — add `v7_startTransition` and `v7_relativeSplatPath` future flags to `BrowserRouter`.
11. **No storage buckets** — store logos / response screenshots can't be uploaded.
12. **SEO**: `index.html` title/description/canonical/og:* not audited; sitemap reflects only `/`.
13. **Activity log usage low** (6 rows). Verify writes from key mutations (uploads, scrape, sync, admin actions).

### P3 — Nice-to-haves
14. Rotate Lovable API key / review managed secrets surfaced in `<secrets>`.
15. Add a "last sync" indicator on Reviews and Promotions pages.
16. Empty / loading states audit across all pages.

---

## 3. Recommended order of work

```text
Week 1 — unblock data pipeline
  1. Reconnect Firecrawl (Connectors panel) → re-run scrape-uber-eats for items
  2. Add/remap Northcliff store → backfill 1,436 reviews via google_places.store_id update
  3. Verify deep_link backfill across all 2,780 items; spot-check coverage

Week 2 — admin & emails
  4. Confirm sidebar surfaces /admin/users for admins only
  5. Set up custom email domain + branded magic-link template (Lovable Email)
  6. Decide on Apify provider: remove toggle or wire it

Week 3 — automation & performance
  7. Add pg_cron schedules for sync-google-reviews (daily) and sync-airtable pull (hourly)
  8. Create review_global_stats view; refactor useReviewStats to use it
  9. Suppress React Router v6 deprecation warnings via future flags

Week 4 — quality
 10. Tests for reviewKpis.ts and admin-users edge function
 11. SEO pass: title/description/canonical, expand sitemap to all public routes
 12. Empty/loading state audit
```

---

## 4. Technical notes (for implementation)

- **Northcliff fix**: either `INSERT INTO stores (name, slug) VALUES ('Col''Cacchio Northcliff', 'northcliff')` then `UPDATE google_places SET store_id = (...) WHERE title = 'Col''Cacchio Northcliff'` — the existing AFTER UPDATE trigger will cascade into `google_reviews`.
- **Firecrawl reconnect**: Connectors → Firecrawl → reconnect. No code change needed; existing edge function will start succeeding again.
- **Deep-link backfill**: from `/uber-eats` page, run "Scrape item links" per store, or add a "bulk scrape items" entry to `BulkScrapePanel`.
- **Router warnings fix**: pass `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}` to `<BrowserRouter>` in `src/App.tsx`.

Tell me which item(s) you want me to start with and I'll execute.
