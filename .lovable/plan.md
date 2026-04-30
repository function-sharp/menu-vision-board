# Make Supabase the source of truth — full two-way sync

You picked: **Supabase wins** for conflicts, **manual buttons** to trigger every sync (no schedule), and four sync directions enabled. The existing `sync-airtable` function and Excel uploader both **overwrite Supabase**, which loses scrape results and inline edits. We'll fix all of that.

## What changes

```text
Supabase = source of truth
  ↑↑↑                              ↓↓↓
  │ │ └─ Airtable → Supabase  (auto-fill blanks only)
  │ └─── Excel    → Supabase  (merge, keep manual edits)
  └───── Scraper  → Supabase  (already wired, made more thorough)
                     ↓↓↓
                Supabase → Airtable  (push edits/scrape results back)
```

Every change shows up in **one Sync Center** card on the Uber Eats hub:

```text
┌─ Sync Center (manual) ──────────────────────────────────┐
│ [Pull from Airtable]  [Push to Airtable]  [Sync log]    │
│ Last pull:  2h ago — 12 fills, 0 conflicts              │
│ Last push:  10m ago — 3 stores updated in Airtable      │
└─────────────────────────────────────────────────────────┘
```

## Conflict rule (everywhere)

**Supabase wins.** Concretely:
- Airtable→Supabase only writes a field if Supabase value is `NULL`/empty.
- Excel→Supabase merges instead of wiping; existing non-null fields are kept.
- Supabase→Airtable always overwrites Airtable.
- Scraper writes always succeed (you triggered them, you want them).

A new column `manually_edited_at timestamptz` on `stores` and `menu_items` records when a value was last set by inline edit / scrape, so we can show "modified since last Airtable pull" in the UI.

## Backend changes

**1 schema migration**
- `stores.manually_edited_at timestamptz`
- `menu_items.manually_edited_at timestamptz`
- `sync_runs` table (id, direction, source, started_at, finished_at, status, summary jsonb, error text) — feeds the Sync log drawer.

**Edge function: `sync-airtable` (rewrite)**
Two modes via request body `{ direction: "pull" | "push" }`.

- `pull` (replaces today's behaviour):
  - Fetch Stores + Promotion Tracker from Airtable (gateway, unchanged).
  - For each Airtable store: only set `uber_eats_url`, `address`, `cuisine`, `price_range`, etc. **if the Supabase value is NULL**. Counts: filled / skipped (because Supabase had a value) / unmatched.
  - Promotions still upsert by `airtable_id` (Airtable owns promos — no manual editing of those in this app).
  - Writes a row to `sync_runs`.

- `push`:
  - Read all Supabase stores that have either `manually_edited_at IS NOT NULL` or a `uber_eats_url` not present in Airtable.
  - For each, find the Airtable record by name (same normalisation we already do) and PATCH `Uber Eats URL`, `Address`, `Cuisine`, `Price Range` back into Airtable.
  - Counts: pushed / skipped / not-found-in-airtable.
  - Writes a row to `sync_runs`.

**Edge function: `merge-excel` (new)**
The current Excel upload runs in the browser and does `delete()` on both tables. Move it to an edge function that does:

1. Receive parsed rows (browser still parses XLSX with `xlsx` to keep the existing UX — only the writes move server-side).
2. Upsert stores by `slug`. For each store, only fill columns where the Supabase row is NULL — exception: `name`, `slug`, `item_count` always update.
3. For items: upsert by `(store_id, name)`. Same NULL-only rule for `price`, `description`, `category`, `currency`, `deep_link`. Items present in Supabase but not in Excel are **kept** (no deletion) — Supabase wins.
4. Returns `{stores_inserted, stores_merged, items_inserted, items_merged, items_kept}`.
5. Logs to `sync_runs` and `uploads`.

**Edge function: `scrape-uber-eats` (small additions)**
- On every successful write to `stores` or `menu_items`, also set `manually_edited_at = now()` so push-back can detect it.
- Already writes to `scrape_jobs` — no change there.

## Frontend changes

- **`src/pages/UberEats.tsx`**: replace the current "Bulk scrape (Firecrawl)" card with a tabbed **Sync Center** card:
  - Tab 1 *Scrape* — current bulk scrape buttons.
  - Tab 2 *Airtable* — `Pull from Airtable` and `Push to Airtable` buttons + last-run summary.
  - Tab 3 *Excel* — quick link to `/upload`.
  - Job log drawer becomes a unified "Sync log" showing both `scrape_jobs` and `sync_runs` rows.

- **`src/pages/Upload.tsx`**: rewrite Excel handler to call the new `merge-excel` edge function. Add a clear "Merge mode (Supabase wins)" badge and remove the warning that uploads "replace all existing data". Keep the Airtable section but make it obvious it's now bi-directional.

- **`src/pages/StoreDetail.tsx`**: small "Last edited X ago" stamp under the title when `manually_edited_at` is set.

## Out of scope (per your answers)

- No cron schedule; everything is button-triggered.
- No "lock" flag — the rule is uniformly "Supabase wins". `manually_edited_at` is just for visibility, not enforcement.
- No deletion of Supabase rows from Excel/Airtable syncs (Supabase is the source of truth).

## Order of operations

1. Migration: add `manually_edited_at` columns + `sync_runs` table.
2. Rewrite `sync-airtable` to support `pull` (NULL-only) and `push`.
3. Create `merge-excel` function; move write logic out of `Upload.tsx`.
4. Update `scrape-uber-eats` to stamp `manually_edited_at`.
5. Build Sync Center card in `UberEats.tsx`; rewire `Upload.tsx`; small badge in `StoreDetail.tsx`.
6. Smoke-test: pull → no overwrite of scraped Col'Cacchio metadata; push → Airtable record updates.
