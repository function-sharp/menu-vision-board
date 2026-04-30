# Scraper integration for the Uber Eats hub

Add a backend-driven scraper that uses **Firecrawl** to (1) find missing Uber Eats store URLs, (2) extract item deep links from a store's UE page, (3) pull store metadata (rating, rating count, price range, address, cuisine), and (4) re-validate existing URLs. Each job is triggerable per-row or in bulk from `src/pages/UberEats.tsx`. **Apify** is wired in as a stored secret so we can add an Apify-backed job later without another integration round.

## What gets built

```text
Uber Eats hub (existing page)
├── Per-row actions
│   ├── Stores table  → [Find URL] · [Refresh metadata] · [Validate URL]
│   └── Items  table  → [Find deep link]
├── Bulk action bar
│   ├── Scrape all missing store URLs        (uses search)
│   ├── Scrape all missing item deep links   (groups items by store, 1 scrape per store)
│   ├── Refresh metadata for all stores
│   └── Validate all stored URLs
└── Job log drawer  → live status + last 50 runs (from new scrape_jobs table)
```

## Backend

**1 connector + 1 secret**
- Connect **Firecrawl** via the standard connector → exposes `FIRECRAWL_API_KEY`.
- Add **`APIFY_TOKEN`** as a Supabase secret (prompted when we get there). No code uses it yet beyond a stub provider switch — keeps the door open.

**1 new edge function: `scrape-uber-eats`**

Single function, action-routed via request body, all server-side:

```ts
POST /functions/v1/scrape-uber-eats
body: { action, payload, provider? }   // provider defaults to "firecrawl"
```

Actions:
| Action | Input | What it does |
|---|---|---|
| `find_store_url` | `{ store_id }` | Firecrawl `/v2/search` with query `"<store name> <address?> site:ubereats.com"`, picks first `ubereats.com/store/...` result, updates `stores.uber_eats_url`. |
| `scrape_store_metadata` | `{ store_id }` | Firecrawl `/v2/scrape` with `formats: [{ type: 'json', schema }]` over the store's `uber_eats_url`. Updates `rating`, `rating_count`, `price_range`, `address`, `cuisine`. |
| `scrape_item_links` | `{ store_id }` | Firecrawl `/v2/scrape` with `formats: ['links','markdown']` on the UE store page; matches `menu_items.name` (fuzzy) against menu-item links and fills `deep_link`. |
| `validate_url` | `{ store_id}` or `{ item_id }` | HEAD/GET via Firecrawl scrape with `onlyMainContent:false`; checks status + that the page still references the store name; writes result to `scrape_jobs`. |

Implementation notes:
- Uses gateway pattern: `https://connector-gateway.lovable.dev/firecrawl/v2/...` with `Authorization: Bearer ${LOVABLE_API_KEY}` and `X-Connection-Api-Key: ${FIRECRAWL_API_KEY}`.
- Zod-validates body, returns CORS headers on every response (including errors).
- `provider` enum is `"firecrawl" | "apify"`; `apify` branch throws `"Not implemented yet"` for now.

**1 new table: `scrape_jobs`** (migration)

```sql
create table public.scrape_jobs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  provider text not null default 'firecrawl',
  target_type text not null,        -- 'store' | 'item'
  target_id uuid not null,
  status text not null default 'pending',  -- pending | running | success | error
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.scrape_jobs enable row level security;
create policy "Public read scrape_jobs" on public.scrape_jobs for select using (true);
create policy "Public insert scrape_jobs" on public.scrape_jobs for insert with check (true);
create policy "Public update scrape_jobs" on public.scrape_jobs for update using (true);
```

(Matches the existing public-RLS pattern used by `stores`, `menu_items`, etc. No auth in this app.)

## Frontend

Edits to `src/pages/UberEats.tsx`:
- New `useScrape()` hook wrapping `supabase.functions.invoke("scrape-uber-eats", …)` with React Query mutations and toast feedback. Invalidates `["stores"]` / `["all-items"]` on success.
- Per-row icon buttons (next to the existing pencil edit) for each action listed above. Spinner while running, green check on success, red on failure with tooltip showing the error.
- New **Bulk scrape** card above the stores section with the four bulk buttons. Bulk runs are sequential with a `Progress` bar (`x / total`) and a Cancel button; each row's result is upserted as it finishes.
- New **Job log** sheet (slide-over) listing the last 50 rows of `scrape_jobs`, auto-refreshing every 5s while a bulk run is active.

No changes to `Stores.tsx` / `StoreDetail.tsx` — the hub is the single entry point.

## Out of scope (this round)

- Apify implementation (token stored, switch stubbed).
- Scheduled / cron-based re-validation.
- Rate-limit beyond simple sequential bulk; will revisit if Firecrawl 429s.
- Per-user auth on scrape endpoints (matches current public-RLS posture of the app).

## Order of operations

1. Connect Firecrawl connector.
2. Add `APIFY_TOKEN` secret (prompt user).
3. Create `scrape_jobs` migration.
4. Create `supabase/functions/scrape-uber-eats/index.ts`.
5. Wire per-row + bulk UI into `src/pages/UberEats.tsx`.
6. Smoke-test via the deployed function with one real store.
