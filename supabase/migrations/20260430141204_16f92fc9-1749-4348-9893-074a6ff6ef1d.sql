-- Matching helper: returns a best-guess store_id for a given place title
CREATE OR REPLACE FUNCTION public.match_store_for_place_title(p_title text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kw text;
  v_first text;
  v_store_id uuid;
BEGIN
  IF p_title IS NULL THEN RETURN NULL; END IF;
  v_kw := regexp_replace(
    regexp_replace(lower(p_title), '^col''cacchio\s*(go\s*)?', '', 'g'),
    '[,\-]', ' ', 'g'
  );
  v_kw := trim(regexp_replace(v_kw, '\s+', ' ', 'g'));
  IF v_kw = '' THEN RETURN NULL; END IF;
  v_first := split_part(v_kw, ' ', 1);

  -- Try first-word match against normalised store keyword
  SELECT id INTO v_store_id
  FROM stores
  WHERE split_part(
          trim(regexp_replace(
            regexp_replace(
              regexp_replace(lower(name), '^col''cacchio\s*(go\s*)?,?\s*', '', 'g'),
              '[,\-]', ' ', 'g'
            ), '\s+', ' ', 'g'
          )),
          ' ', 1
        ) = v_first
  LIMIT 1;

  IF v_store_id IS NOT NULL THEN RETURN v_store_id; END IF;

  -- Fallback: substring match (handles Montecasino, Durbanville, etc.)
  SELECT id INTO v_store_id
  FROM stores
  WHERE lower(name) LIKE '%' || v_first || '%'
  LIMIT 1;

  RETURN v_store_id;
END;
$$;

-- Trigger to auto-fill store_id on google_places insert/update
CREATE OR REPLACE FUNCTION public.google_places_set_store()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.store_id IS NULL THEN
    NEW.store_id := public.match_store_for_place_title(NEW.title);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_google_places_set_store ON public.google_places;
CREATE TRIGGER trg_google_places_set_store
  BEFORE INSERT OR UPDATE OF title, store_id ON public.google_places
  FOR EACH ROW EXECUTE FUNCTION public.google_places_set_store();

-- Trigger to propagate place.store_id to all reviews
CREATE OR REPLACE FUNCTION public.google_places_propagate_store()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.store_id IS DISTINCT FROM OLD.store_id THEN
    UPDATE public.google_reviews SET store_id = NEW.store_id WHERE place_id = NEW.place_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_google_places_propagate ON public.google_places;
CREATE TRIGGER trg_google_places_propagate
  AFTER UPDATE OF store_id ON public.google_places
  FOR EACH ROW EXECUTE FUNCTION public.google_places_propagate_store();

-- Trigger so new reviews inherit place.store_id when their own is null
CREATE OR REPLACE FUNCTION public.google_reviews_set_store()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.store_id IS NULL THEN
    SELECT store_id INTO NEW.store_id FROM public.google_places WHERE place_id = NEW.place_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_google_reviews_set_store ON public.google_reviews;
CREATE TRIGGER trg_google_reviews_set_store
  BEFORE INSERT ON public.google_reviews
  FOR EACH ROW EXECUTE FUNCTION public.google_reviews_set_store();

-- Backfill existing rows
UPDATE public.google_places
SET store_id = public.match_store_for_place_title(title)
WHERE store_id IS NULL;

UPDATE public.google_reviews r
SET store_id = p.store_id
FROM public.google_places p
WHERE r.place_id = p.place_id AND p.store_id IS NOT NULL AND r.store_id IS DISTINCT FROM p.store_id;
