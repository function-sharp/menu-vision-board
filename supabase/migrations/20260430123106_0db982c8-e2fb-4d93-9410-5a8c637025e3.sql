
DROP POLICY IF EXISTS "Public read stores" ON public.stores;
DROP POLICY IF EXISTS "Public insert stores" ON public.stores;
DROP POLICY IF EXISTS "Public update stores" ON public.stores;
DROP POLICY IF EXISTS "Public delete stores" ON public.stores;
CREATE POLICY "Authenticated read stores" ON public.stores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert stores" ON public.stores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update stores" ON public.stores FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete stores" ON public.stores FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read items" ON public.menu_items;
DROP POLICY IF EXISTS "Public insert items" ON public.menu_items;
DROP POLICY IF EXISTS "Public update items" ON public.menu_items;
DROP POLICY IF EXISTS "Public delete items" ON public.menu_items;
CREATE POLICY "Authenticated read items" ON public.menu_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert items" ON public.menu_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update items" ON public.menu_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete items" ON public.menu_items FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read promotions" ON public.promotions;
DROP POLICY IF EXISTS "Public insert promotions" ON public.promotions;
DROP POLICY IF EXISTS "Public update promotions" ON public.promotions;
DROP POLICY IF EXISTS "Public delete promotions" ON public.promotions;
CREATE POLICY "Authenticated read promotions" ON public.promotions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert promotions" ON public.promotions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update promotions" ON public.promotions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete promotions" ON public.promotions FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read scrape_jobs" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Public insert scrape_jobs" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Public update scrape_jobs" ON public.scrape_jobs;
CREATE POLICY "Authenticated read scrape_jobs" ON public.scrape_jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert scrape_jobs" ON public.scrape_jobs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update scrape_jobs" ON public.scrape_jobs FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read sync_runs" ON public.sync_runs;
DROP POLICY IF EXISTS "Public insert sync_runs" ON public.sync_runs;
DROP POLICY IF EXISTS "Public update sync_runs" ON public.sync_runs;
CREATE POLICY "Authenticated read sync_runs" ON public.sync_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert sync_runs" ON public.sync_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update sync_runs" ON public.sync_runs FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read uploads" ON public.uploads;
DROP POLICY IF EXISTS "Public insert uploads" ON public.uploads;
CREATE POLICY "Authenticated read uploads" ON public.uploads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert uploads" ON public.uploads FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public read presets" ON public.menu_filter_presets;
DROP POLICY IF EXISTS "Public insert presets" ON public.menu_filter_presets;
DROP POLICY IF EXISTS "Public update presets" ON public.menu_filter_presets;
DROP POLICY IF EXISTS "Public delete presets" ON public.menu_filter_presets;
CREATE POLICY "Authenticated read presets" ON public.menu_filter_presets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert presets" ON public.menu_filter_presets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update presets" ON public.menu_filter_presets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete presets" ON public.menu_filter_presets FOR DELETE TO authenticated USING (true);
