CREATE TABLE public.scrape_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  provider text NOT NULL DEFAULT 'firecrawl',
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

ALTER TABLE public.scrape_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read scrape_jobs" ON public.scrape_jobs FOR SELECT USING (true);
CREATE POLICY "Public insert scrape_jobs" ON public.scrape_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update scrape_jobs" ON public.scrape_jobs FOR UPDATE USING (true);

CREATE INDEX idx_scrape_jobs_target ON public.scrape_jobs(target_type, target_id);
CREATE INDEX idx_scrape_jobs_created_at ON public.scrape_jobs(created_at DESC);