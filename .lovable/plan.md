# Supabase Integration Audit Plan

Goal: verify every part of the app that talks to Supabase actually works end-to-end, surface issues, and produce a prioritised fix list. No risky writes — read‑only checks first, then targeted test calls.

## Scope

Tables: `stores`, `menu_items`, `promotions`, `uploads`, `scrape_jobs`, `sync_runs`, `menu_filter_presets`
Edge functions: `scrape-uber-eats`, `sync-airtable`, `merge-excel`
Frontend touchpoints: `useDashboardData.ts`, `useScrape.ts`, `UberEats.tsx`, `Upload.tsx`, `MenuBrowser.tsx`, `BulkScrapePanel.tsx`

---

## Phase 1 — Data integrity (read-only SQL)

1. **Orphan check** — `menu_items` rows whose `store_id` doesn't exist in `stores`.
2. **Duplicate check** — duplicate slugs in `stores`, duplicate `(store_id, name)` in `menu_items`, duplicate `airtable_id` in `promotions`.
3. **Counts vs. reality** — compare `stores.item_count` against `COUNT(menu_items)` per store, list mismatches.
4. **Coverage** — stores missing `uber_eats_url`, items missing `deep_link`, items missing `price`.
5. **Currency sanity** — any `currency != 'ZAR'`.
6. **Promotion freshness** — promos with `end_date < today` still showing as active, missing `start_date`/`end_date`.
7. **Sync flag audit** — count rows with `manually_edited_at` set (proves the "Supabase wins" lock works).
8. **Salt Rock mismatch** — find the Airtable name vs. Supabase slug to fix the 1 unmatched store from the last pull.

## Phase 2 — Edge function health

For each function, check recent logs + run one safe test call:

- **scrape-uber-eats** — pick the 1 store whose last `validate_url` failed, re-run validation, capture the error from logs. Confirm `manually_edited_at` is being stamped on success.
- **sync-airtable (pull)** — re-run, confirm "Supabase wins" still kicks in (expect `stores_filled: 0`, `stores_skipped_supabase_wins: 23`).
- **sync-airtable (push)** — **first ever run**. Push to Airtable and capture whether the `Uber Eats URL` field is writable or a read-only lookup. If it errors, document the exact Airtable field name needed.
- **merge-excel** — inspect code path, confirm it never deletes, only upserts blanks. (No test upload unless you want one.)

## Phase 3 — Frontend ↔ Supabase contract

- Verify `useAllItems` pagination really fetches all 2,780 rows (not capped at 1,000).
- Verify the inline URL editor on `/uber-eats` invalidates the right React Query keys (it does: `stores`, `all-items`).
- Verify `MenuBrowser` filter presets save/load/delete against `menu_filter_presets`.
- Confirm the Sync Log sheet's 5s polling isn't hammering the DB unnecessarily — recommend pausing when sheet is closed.

## Phase 4 — Security review

Current state: **every table has fully public RLS** (anon can SELECT/INSERT/UPDATE, most can DELETE). For an internal tool this is a deliberate choice, but worth flagging:

- Run the Supabase linter for any unflagged misconfig.
- Run the agent security scanner.
- Document the risk: anyone with the published URL + anon key can wipe the database. Two options to discuss with you:
  1. **Add auth** (email login, single allowed user/role) — biggest change.
  2. **Keep public reads, lock writes** behind a service-role-only edge function — medium change.
  3. **Accept risk** — document explicitly, do nothing.

## Phase 5 — Observability & cleanup

- Confirm `sync_runs` and `scrape_jobs` are filling correctly for every operation.
- Recommend a small "Last sync per source" widget on Overview.
- Identify dead code / unused tables / unused secrets.
- Check that no edge function logs are leaking secrets (Firecrawl/Airtable keys).

---

## Deliverable

A single markdown report saved to `/mnt/documents/supabase-audit.md` with:
- ✅ what's working
- ⚠️ what's broken or risky (with severity)
- 🔧 a prioritised fix list (P0/P1/P2) with effort estimates
- Specific row-level findings (orphan IDs, mismatched counts, the Salt Rock fix, etc.)

After you approve, I'll switch to build mode and execute Phases 1–5, then write the report. **No schema changes, no destructive writes** — only reads and the two safe edge-function test calls (re-validate 1 URL, run one Airtable pull). The Airtable **push** test will only run if you explicitly opt in, since it's the one operation that mutates an external system.

## Optional add-ons (tell me yes/no)

- **(A)** Run the Airtable push during the audit to confirm it works.
- **(B)** Auto-fix safe issues in the same pass (e.g. recompute `stores.item_count`, fix the Salt Rock name).
- **(C)** Implement the security recommendation you pick.
