ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS manually_edited_at timestamptz;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS manually_edited_at timestamptz;

CREATE TABLE public.sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL,         -- 'pull' | 'push' | 'merge'
  source text NOT NULL,            -- 'airtable' | 'excel' | 'scrape'
  status text NOT NULL DEFAULT 'running', -- 'running' | 'success' | 'error'
  summary jsonb,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read sync_runs" ON public.sync_runs FOR SELECT USING (true);
CREATE POLICY "Public insert sync_runs" ON public.sync_runs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update sync_runs" ON public.sync_runs FOR UPDATE USING (true);

CREATE INDEX idx_sync_runs_started_at ON public.sync_runs(started_at DESC);