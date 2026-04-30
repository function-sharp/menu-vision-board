DROP VIEW IF EXISTS public.review_store_stats;
CREATE VIEW public.review_store_stats
WITH (security_invoker = true) AS
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
