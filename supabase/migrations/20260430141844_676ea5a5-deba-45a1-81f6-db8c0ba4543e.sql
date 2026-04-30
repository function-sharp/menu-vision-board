CREATE TABLE public.review_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NULL,
  period text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  model text,
  summary text,
  themes_positive jsonb,
  themes_negative jsonb,
  action_items jsonb,
  sample_size integer,
  raw jsonb,
  CONSTRAINT review_insights_store_period_unique UNIQUE (store_id, period)
);

-- Note: postgres treats NULL values as distinct, so add a partial unique index for the
-- "all stores" case (store_id IS NULL) so we can upsert idempotently.
CREATE UNIQUE INDEX review_insights_all_stores_period
  ON public.review_insights (period) WHERE store_id IS NULL;

ALTER TABLE public.review_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read review_insights"
  ON public.review_insights FOR SELECT
  TO authenticated USING (true);

CREATE OR REPLACE VIEW public.review_store_stats AS
SELECT
  store_id,
  count(*)::int AS reviews,
  avg(stars)::numeric(4,2) AS avg_stars,
  (count(*) FILTER (where response_text is not null))::float / NULLIF(count(*), 0) AS response_rate,
  avg(extract(epoch from (response_at - published_at)) / 86400)::numeric(8,2) AS avg_reply_days,
  max(published_at) AS last_review_at,
  count(*) FILTER (where published_at >= now() - interval '30 days')::int AS reviews_30d,
  avg(stars) FILTER (where published_at >= now() - interval '30 days')::numeric(4,2) AS avg_stars_30d,
  count(*) FILTER (where published_at >= now() - interval '7 days')::int AS reviews_7d,
  avg(stars) FILTER (where published_at >= now() - interval '7 days')::numeric(4,2) AS avg_stars_7d
FROM public.google_reviews
WHERE store_id IS NOT NULL
GROUP BY store_id;

GRANT SELECT ON public.review_store_stats TO authenticated;
