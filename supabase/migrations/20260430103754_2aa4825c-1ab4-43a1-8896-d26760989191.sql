
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  store_group TEXT,
  cuisine TEXT,
  rating NUMERIC,
  rating_count INTEGER,
  telephone TEXT,
  address TEXT,
  price_range TEXT,
  store_url TEXT,
  item_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  category TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC,
  currency TEXT DEFAULT 'ZAR',
  deep_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_menu_items_store ON public.menu_items(store_id);
CREATE INDEX idx_menu_items_category ON public.menu_items(category);
CREATE INDEX idx_menu_items_name ON public.menu_items(name);

CREATE TABLE public.uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  store_count INTEGER NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  filename TEXT
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read stores" ON public.stores FOR SELECT USING (true);
CREATE POLICY "Public insert stores" ON public.stores FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update stores" ON public.stores FOR UPDATE USING (true);
CREATE POLICY "Public delete stores" ON public.stores FOR DELETE USING (true);

CREATE POLICY "Public read items" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "Public insert items" ON public.menu_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update items" ON public.menu_items FOR UPDATE USING (true);
CREATE POLICY "Public delete items" ON public.menu_items FOR DELETE USING (true);

CREATE POLICY "Public read uploads" ON public.uploads FOR SELECT USING (true);
CREATE POLICY "Public insert uploads" ON public.uploads FOR INSERT WITH CHECK (true);
