## Plan: Link Col'Cacchio OS (Airtable)

Airtable is connected. Base **Col'Cacchio OS** has two tables we'll use:
- **Stores** — Store name, Group, `Uber Eats URL (from Master Store)`
- **Promotion Tracker** — 20 fields (theme, dates, mechanic, status, priority, approvals, etc.)

Sync is **manual only** — triggered from the Excel upload page and a new "Sync from Airtable" button. No schedule.

### 1. Database changes

Add to `stores`:
- `uber_eats_url text`

New table `promotions` (mirrors Airtable, refreshed on each sync):
- `id uuid pk`, `airtable_id text unique`, `promo_id text`, `month text`, `week text`,
  `start_date date`, `end_date date`, `theme text[]`, `store_group text`,
  `offer_type text`, `messaging text`, `mechanic text`, `recommended_items text[]`,
  `audience text`, `funding_split text`, `status text`, `rationale text`,
  `margin_check text`, `priority text`, `marketing_approval text`,
  `operations_approval text`, `synced_at timestamptz default now()`

Public RLS (read/insert/update/delete) — matches existing pattern.

Extend `uploads.note` usage to log Airtable syncs (or add `source text` column with default `'excel'`).

### 2. Edge function: `sync-airtable`

- Calls `https://connector-gateway.lovable.dev/airtable/v0/appGQEVbE8o5NRK1K/...` using `LOVABLE_API_KEY` + `AIRTABLE_API_KEY`.
- Fetches **Stores** → matches by normalised store name (strip punctuation/case) against `stores.name` → updates `uber_eats_url`. Returns list of unmatched Airtable rows for visibility.
- Fetches **Promotion Tracker** → upserts into `promotions` keyed on `airtable_id`. Deletes rows whose `airtable_id` no longer exists.
- Returns `{ stores_updated, stores_unmatched, promotions_upserted, promotions_removed }`.
- Logs a row into `uploads` with source `airtable`.

### 3. Frontend

**Upload page** — add a second card "Sync from Airtable (Col'Cacchio OS)" with a Sync button, last-sync timestamp, and a results panel showing counts + any unmatched store names.

**Stores list & StoreDetail** — when `uber_eats_url` is present, show an "Order on Uber Eats" button (opens in new tab). Also surface it as a small badge on store cards.

**New page `/promotions`** (added to sidebar as "Promotions"):
- KPI strip: total promos, active this month, awaiting approval, by store group.
- Table with filters: Month, Store Group, Status, Priority, Offer Type.
- Row expands to show full mechanic / messaging / rationale / approvals.
- Empty state prompts user to run an Airtable sync.

### Technical notes
- Store-name matching: normalise both sides (lowercase, remove `'`, `,`, `–`, "GO", extra whitespace) and fall back to fuzzy contains. Surface unmatched in UI so we can fix names manually.
- Airtable rich text (`mechanic`, `messaging`, etc.) stored as plain markdown text; rendered with `whitespace-pre-wrap`.
- All Airtable calls live server-side in the edge function — frontend just invokes it via `supabase.functions.invoke('sync-airtable')`.
- No scheduled cron; sync runs only from the button click (and conceptually after an Excel upload, but it stays a separate explicit action).
