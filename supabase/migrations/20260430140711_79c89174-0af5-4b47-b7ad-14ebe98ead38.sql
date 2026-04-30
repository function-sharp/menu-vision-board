CREATE TABLE public.google_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id text NOT NULL UNIQUE,
  store_id uuid NULL,
  title text NOT NULL,
  address text,
  city text,
  postal_code text,
  country_code text,
  lat numeric,
  lng numeric,
  total_score numeric,
  reviews_count integer,
  url text,
  cid text,
  fid text,
  kgmid text,
  category_name text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.google_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id text NOT NULL UNIQUE,
  place_id text NOT NULL,
  store_id uuid NULL,
  reviewer_id text,
  reviewer_name text,
  reviewer_photo_url text,
  reviewer_review_count integer,
  is_local_guide boolean,
  stars integer,
  text text,
  text_translated text,
  original_language text,
  published_at timestamptz,
  publish_at_label text,
  likes_count integer,
  response_text text,
  response_at timestamptz,
  detailed_food integer,
  detailed_service integer,
  detailed_atmosphere integer,
  review_url text,
  image_urls text[],
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_google_reviews_store ON public.google_reviews(store_id);
CREATE INDEX idx_google_reviews_place ON public.google_reviews(place_id);
CREATE INDEX idx_google_reviews_published ON public.google_reviews(published_at DESC);
CREATE INDEX idx_google_reviews_stars ON public.google_reviews(stars);
CREATE INDEX idx_google_places_store ON public.google_places(store_id);

ALTER TABLE public.google_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read google_places"
  ON public.google_places FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated read google_reviews"
  ON public.google_reviews FOR SELECT
  TO authenticated USING (true);
