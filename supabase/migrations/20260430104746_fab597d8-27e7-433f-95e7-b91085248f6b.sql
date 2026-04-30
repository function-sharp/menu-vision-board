
CREATE TABLE public.menu_filter_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  search_query TEXT,
  store_slug TEXT,
  category TEXT,
  store_group TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_filter_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read presets" ON public.menu_filter_presets FOR SELECT USING (true);
CREATE POLICY "Public insert presets" ON public.menu_filter_presets FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update presets" ON public.menu_filter_presets FOR UPDATE USING (true);
CREATE POLICY "Public delete presets" ON public.menu_filter_presets FOR DELETE USING (true);
