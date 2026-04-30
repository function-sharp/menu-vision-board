## Goal

Add a Google **Customer Reviews** feature powered by your Apify dataset (`bg5J0WsBCpIhuxNDp`, ~28,846 reviews across 3 stores so far: Montecasino, Belvedere, Blouberg). Reviews are ingested into Lovable Cloud, surfaced on a new **Reviews** page, and shown on each store's detail page.

## What you'll get

1. **New "Reviews" page** in the sidebar (`/reviews`) with:
   - KPI cards: total reviews, average stars, % responded by owner, last 30 days count
   - Star distribution bar (5★…1★)
   - Detailed sub-rating averages (Food, Service, Atmosphere)
   - Filters: store, star rating, has-text, has-owner-response, date range, search query
   - Sortable list of review cards (newest, highest, lowest, most liked) with reviewer name/photo, stars, date, full text, owner response, sub-ratings
   - "Sync from Apify" button (admin) + last-sync indicator
   - CSV export of the filtered view
2. **Per-store Reviews tab** on `/stores/:slug` showing that store's reviews, average rating, and distribution
3. **Overview page** gets a small "Recent reviews" widget (latest 5 across all stores)
4. Activity log entries for every sync run (action `reviews.sync`, with counts inserted/updated)

## Data model (new tables)

```text
google_places
  id uuid pk
  place_id text unique          -- e.g. ChIJi9sSL6x2lR4RhDUxxCIq-1w
  store_id uuid null            -- linked store (nullable; matched by name/slug)
  title text                    -- "Col'Cacchio Montecasino"
  address, city, postal_code, country_code text
  lat, lng numeric
  total_score numeric           -- aggregate Google score
  reviews_count int             -- aggregate Google count
  url text                      -- maps url
  cid text, fid text, kgmid text
  last_synced_at timestamptz
  created_at timestamptz default now()

google_reviews
  id uuid pk
  review_id text unique         -- Apify reviewId, dedupe key
  place_id text fk -> google_places.place_id
  store_id uuid null            -- denormalised from place
  reviewer_id text
  reviewer_name text
  reviewer_photo_url text
  reviewer_review_count int
  is_local_guide bool
  stars int
  text text
  text_translated text
  original_language text
  published_at timestamptz
  publish_at_label text         -- "a day ago"
  likes_count int
  response_text text
  response_at timestamptz
  detailed_food int, detailed_service int, detailed_atmosphere int
  review_url text
  image_urls text[]
  raw jsonb                     -- full payload for forward-compat
  created_at timestamptz default now()
```

RLS: authenticated read for both; insert/update restricted to service-role (used only by the edge function). Indexes on `store_id`, `place_id`, `published_at desc`, `stars`.

## Sync edge function

`supabase/functions/sync-google-reviews/index.ts`
- Hardcodes the Apify dataset id; `APIFY_TOKEN` already exists as a secret
- Paginates dataset (`limit=1000&offset=…`) until exhausted (~29 pages today)
- Upserts `google_places` from each row's place fields
- Upserts `google_reviews` keyed on `review_id`
- Attempts to match `place_id`/title to existing `stores` rows (case-insensitive name contains "Col'Cacchio X" → matches store with same trailing name) and stores `store_id`
- Returns `{ inserted, updated, places, total }` and writes a `sync_runs` row + `activity_log` entry
- Triggered manually from the Reviews page via `supabase.functions.invoke("sync-google-reviews")`

The user can later swap to a different Apify dataset by editing one constant (or we can promote it to a secret if you prefer).

## Frontend pieces

- `src/hooks/useReviews.ts` — `useReviews(filters)`, `useReviewStats(storeId?)`, `useSyncReviews()`
- `src/pages/Reviews.tsx` — main page (KPIs, filters, distribution, list, export)
- `src/components/ReviewCard.tsx` — review row with avatar, stars, body, owner response collapsible
- `src/components/StarDistribution.tsx` — 5→1 bar chart
- `src/pages/StoreDetail.tsx` — add a Tabs wrapper with "Menu" + "Reviews"
- `src/pages/Overview.tsx` — add "Latest reviews" card
- `src/components/AppSidebar.tsx` — new entry "Reviews" (icon: `MessageSquare`)
- `src/App.tsx` — register `/reviews`
- `src/components/GlobalSearch.tsx` — include reviewer names + review snippets

## Store matching

3 places map cleanly to existing stores by suffix:

```text
Col'Cacchio Montecasino → store slug montecasino
Col'Cacchio Belvedere   → store slug belvedere
Col'Cacchio Blouberg    → store slug blouberg
```

Matching runs at sync time; unmatched places are kept (visible on the global Reviews page) and can be linked later.

## Out of scope (let me know if you want any)

- Auto-scheduled sync (cron) — first version is manual button only
- Sentiment analysis / topic extraction via Lovable AI
- Replying to reviews from the dashboard

After you approve, I'll create the migration, deploy the edge function, run the first sync, and build the UI.