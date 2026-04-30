## Goal

Expand **Reviews** into a flagship hub on par with Uber Eats, **without changing anything that already works**. Everything new is additive — existing routes, components, queries, and behaviour stay intact.

## Guarantees about what does NOT change

- `/reviews` route, sidebar entry, sync button, CSV export, manual sync function (`sync-google-reviews`) — unchanged
- `useReviews` / `useReviewStats` / `useGooglePlaces` hooks — unchanged signatures (only new hooks added)
- Existing `ReviewCard`, `StarDistribution`, `Stars` components — unchanged
- StoreDetail's current Reviews tab — unchanged (we'll add an optional widget *above* the existing list, behind a feature toggle if needed)
- Activity Log, Overview, Uber Eats, Stores, Menu pages — unchanged

## What gets added

### 1. New tabbed layout on `/reviews` — wraps the existing page

`Reviews.tsx` becomes a thin wrapper that renders 5 tabs. The current content moves verbatim into the **"Reviews"** tab so its UX is byte-identical. New tabs surround it:

```text
[Overview] [Stores] [Reviews ← existing UI]  [Insights] [Manage Links]
```

If you ever want to revert, the "Reviews" tab alone is the original page.

### Tab — Overview (new)
- KPI strip: total / avg stars / response rate / avg reply time / unique reviewers / 30-day delta
- **Monthly trend chart** (recharts): review volume bars + avg-rating line, last 24 months
- **Response performance**: % responded by star, median reply time per star
- **Top 5 stores by volume** + **Bottom 5 by rating** leaderboards with sparklines

### Tab — Stores (new)
- Sortable table: store · group · total reviews · avg stars · 30-day reviews · 30-day avg · 12-month sparkline · response rate · avg reply time · last review
- Row click → existing `/stores/:slug` (which already has the Reviews tab)
- Filters: store group, min reviews

### Tab — Reviews (existing UI, untouched)
- The whole current page is moved here as a child component (`ReviewsListTab`), unchanged.

### Tab — Insights (new, AI)
- "Generate insights for [store / period]" button → calls new `analyze-reviews` edge function (Lovable AI Gateway, `google/gemini-2.5-flash`)
- Returns + caches `{summary, themes_positive[], themes_negative[], action_items[]}`
- Cards render themes with example review quotes; click a quote opens it in the Reviews tab

### Tab — Manage Links (new)
- Lists all 25 `google_places` with Google rating + review count
- Inline-editable store mapping for the 3 unlinked places (Durbanville / Montecasino / Northcliff) using existing inline-edit pattern from Uber Eats
- "Open on Google Maps" + copy URL buttons
- Trigger from migration auto-propagates the link to all reviews

## Cross-app integration (additive only)

- **Global Search (`⌘K`)**: add a "Reviews" result group below the existing groups (Stores / Items / Categories). Clicking a result navigates to `/reviews?focus=<reviewId>` — the Reviews tab opens, scrolls the matching review into view, and pulses it. Existing search behaviour for stores/items/categories unchanged.
- **Stores Overview page**: add **two new optional columns** at the end (Google rating · Google reviews count) sourced from `google_places`. Existing columns and sorts unchanged.
- **Overview page**: add a single new "Reviews pulse" card at the bottom of the existing grid (does not displace anything).
- **StoreDetail Reviews tab**: prepend a small **trend chart card** above the existing Avg/Distribution/List trio. The existing trio renders unchanged below it. If you don't want the prepend, we can put it inside a collapsible.

## Backend additions

### Migration (purely additive — no changes to existing tables)

```sql
CREATE TABLE public.review_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NULL,
  period text NOT NULL,             -- '7d'|'30d'|'90d'|'12m'|'all'
  generated_at timestamptz DEFAULT now(),
  model text,
  summary text,
  themes_positive jsonb,
  themes_negative jsonb,
  action_items jsonb,
  raw jsonb,
  UNIQUE (store_id, period)
);
ALTER TABLE public.review_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read review_insights" ON public.review_insights
  FOR SELECT TO authenticated USING (true);

-- Read-only convenience view for the Stores tab
CREATE OR REPLACE VIEW public.review_store_stats AS
SELECT
  store_id,
  count(*) AS reviews,
  avg(stars)::numeric(4,2) AS avg_stars,
  count(*) FILTER (where response_text is not null)::float / nullif(count(*),0) AS response_rate,
  avg(extract(epoch from (response_at - published_at))/86400) AS avg_reply_days,
  max(published_at) AS last_review_at,
  count(*) FILTER (where published_at >= now() - interval '30 days') AS reviews_30d,
  avg(stars) FILTER (where published_at >= now() - interval '30 days')::numeric(4,2) AS avg_stars_30d
FROM google_reviews
WHERE store_id IS NOT NULL
GROUP BY store_id;
```

### New edge function `analyze-reviews`
- Pulls latest ~300 text reviews for the requested store/period
- Sends to `google/gemini-2.5-flash` via Lovable AI Gateway with strict JSON schema prompt
- Upserts into `review_insights`
- Returns the cached row when one already exists newer than 24h (avoids token spend)

## New frontend files (none replace existing files)

- `src/pages/Reviews.tsx` — thin wrapper with Tabs (existing page content extracted into `ReviewsListTab`)
- `src/components/reviews/OverviewTab.tsx`
- `src/components/reviews/StoresTab.tsx`
- `src/components/reviews/ReviewsListTab.tsx` (the current `Reviews.tsx` body, lifted as-is)
- `src/components/reviews/InsightsTab.tsx`
- `src/components/reviews/ManageLinksTab.tsx`
- `src/components/reviews/ReviewTrendChart.tsx`
- `src/components/reviews/ResponsePerformance.tsx`
- `src/components/reviews/StoreLeaderboard.tsx`
- `src/hooks/useReviews.ts` — append `useReviewTrend`, `useStoreReviewStats`, `useReviewInsights`, `useGenerateInsights` (existing exports untouched)

Touched (additive only):
- `src/components/GlobalSearch.tsx` — add a Reviews result group
- `src/pages/StoresOverview.tsx` — append two new columns
- `src/pages/Overview.tsx` — append "Reviews pulse" card
- `src/pages/StoreDetail.tsx` — prepend trend card inside Reviews tab

## Out of scope

- Replying to Google reviews from the dashboard (needs Google Business Profile OAuth)
- Scheduled syncs
- Per-reviewer pages
- Any change to existing store/menu/promotion/upload flows

After approval I'll build everything in one pass.