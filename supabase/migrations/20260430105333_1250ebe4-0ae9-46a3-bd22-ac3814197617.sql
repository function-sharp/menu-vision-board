ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS uber_eats_url text;

ALTER TABLE public.uploads ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'excel';

CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE NOT NULL,
  promo_id text,
  month text,
  week text,
  start_date date,
  end_date date,
  theme text[],
  store_group text,
  offer_type text,
  messaging text,
  mechanic text,
  recommended_items text[],
  audience text,
  funding_split text,
  status text,
  rationale text,
  margin_check text,
  priority text,
  marketing_approval text,
  operations_approval text,
  date_range_original text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promotions_status ON public.promotions(status);
CREATE INDEX IF NOT EXISTS idx_promotions_month ON public.promotions(month);
CREATE INDEX IF NOT EXISTS idx_promotions_store_group ON public.promotions(store_group);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read promotions" ON public.promotions FOR SELECT USING (true);
CREATE POLICY "Public insert promotions" ON public.promotions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update promotions" ON public.promotions FOR UPDATE USING (true);
CREATE POLICY "Public delete promotions" ON public.promotions FOR DELETE USING (true);