import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type GoogleReview = {
  id: string;
  review_id: string;
  place_id: string;
  store_id: string | null;
  reviewer_name: string | null;
  reviewer_photo_url: string | null;
  reviewer_review_count: number | null;
  is_local_guide: boolean | null;
  stars: number | null;
  text: string | null;
  text_translated: string | null;
  original_language: string | null;
  published_at: string | null;
  publish_at_label: string | null;
  likes_count: number | null;
  response_text: string | null;
  response_at: string | null;
  detailed_food: number | null;
  detailed_service: number | null;
  detailed_atmosphere: number | null;
  review_url: string | null;
  image_urls: string[] | null;
};

export type GooglePlace = {
  id: string;
  place_id: string;
  store_id: string | null;
  title: string;
  address: string | null;
  city: string | null;
  total_score: number | null;
  reviews_count: number | null;
  url: string | null;
  last_synced_at: string | null;
};

export interface ReviewFilters {
  storeId?: string | null;
  stars?: number | null; // exact star value
  hasText?: boolean;
  hasResponse?: boolean;
  search?: string;
  sortBy?: "newest" | "oldest" | "highest" | "lowest" | "likes";
  limit?: number;
}

export const useGooglePlaces = () =>
  useQuery({
    queryKey: ["google-places"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_places")
        .select("*")
        .order("title");
      if (error) throw error;
      return (data ?? []) as GooglePlace[];
    },
  });

export const useReviews = (filters: ReviewFilters = {}) =>
  useQuery({
    queryKey: ["google-reviews", filters],
    queryFn: async () => {
      let q = supabase.from("google_reviews").select("*");
      if (filters.storeId) q = q.eq("store_id", filters.storeId);
      if (filters.stars) q = q.eq("stars", filters.stars);
      if (filters.hasText) q = q.not("text", "is", null);
      if (filters.hasResponse) q = q.not("response_text", "is", null);
      if (filters.search && filters.search.trim()) {
        const s = filters.search.trim().replace(/[%_]/g, "");
        q = q.or(`text.ilike.%${s}%,reviewer_name.ilike.%${s}%,response_text.ilike.%${s}%`);
      }
      const sort = filters.sortBy ?? "newest";
      switch (sort) {
        case "oldest":
          q = q.order("published_at", { ascending: true, nullsFirst: false });
          break;
        case "highest":
          q = q.order("stars", { ascending: false, nullsFirst: false }).order("published_at", { ascending: false });
          break;
        case "lowest":
          q = q.order("stars", { ascending: true, nullsFirst: false }).order("published_at", { ascending: false });
          break;
        case "likes":
          q = q.order("likes_count", { ascending: false, nullsFirst: false }).order("published_at", { ascending: false });
          break;
        default:
          q = q.order("published_at", { ascending: false, nullsFirst: false });
      }
      q = q.limit(filters.limit ?? 200);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GoogleReview[];
    },
  });

// Aggregate stats computed via individual count queries (cheap with indexes)
export const useReviewStats = (storeId?: string | null) =>
  useQuery({
    queryKey: ["google-review-stats", storeId ?? "all"],
    queryFn: async () => {
      const base = () => {
        let q = supabase.from("google_reviews").select("stars, response_text, published_at, detailed_food, detailed_service, detailed_atmosphere", { count: "exact" });
        if (storeId) q = q.eq("store_id", storeId);
        return q;
      };
      // pull a sample for averages — capped to 5000 for performance
      let q = supabase.from("google_reviews").select("stars,response_text,published_at,detailed_food,detailed_service,detailed_atmosphere");
      if (storeId) q = q.eq("store_id", storeId);
      const { data, error } = await q.limit(50000);
      if (error) throw error;
      const rows = data ?? [];
      const total = rows.length;
      const dist = [0, 0, 0, 0, 0]; // index 0 = 1 star
      let starSum = 0;
      let starCount = 0;
      let responded = 0;
      let last30 = 0;
      let foodSum = 0, foodN = 0, svcSum = 0, svcN = 0, atmSum = 0, atmN = 0;
      const cutoff = Date.now() - 30 * 86400_000;
      for (const r of rows) {
        if (r.stars && r.stars >= 1 && r.stars <= 5) {
          dist[r.stars - 1]++;
          starSum += r.stars;
          starCount++;
        }
        if (r.response_text) responded++;
        if (r.published_at && new Date(r.published_at).getTime() >= cutoff) last30++;
        if (r.detailed_food != null) { foodSum += r.detailed_food; foodN++; }
        if (r.detailed_service != null) { svcSum += r.detailed_service; svcN++; }
        if (r.detailed_atmosphere != null) { atmSum += r.detailed_atmosphere; atmN++; }
      }
      return {
        total,
        avgStars: starCount ? starSum / starCount : 0,
        distribution: dist, // [1*,2*,3*,4*,5*]
        responseRate: total ? responded / total : 0,
        last30,
        avgFood: foodN ? foodSum / foodN : 0,
        avgService: svcN ? svcSum / svcN : 0,
        avgAtmosphere: atmN ? atmSum / atmN : 0,
      };
    },
  });

export const useSyncReviews = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-google-reviews");
      if (error) throw new Error(error.message);
      if (data?.ok === false) throw new Error(data?.error ?? "Sync failed");
      return data as { total: number; upserted: number; places: number };
    },
    onSuccess: (d) => {
      toast.success(`Synced ${d.upserted} of ${d.total} reviews from Google`);
      qc.invalidateQueries({ queryKey: ["google-reviews"] });
      qc.invalidateQueries({ queryKey: ["google-places"] });
      qc.invalidateQueries({ queryKey: ["google-review-stats"] });
    },
    onError: (e: Error) => toast.error(e.message || "Sync failed"),
  });
};

// ----- Additive hooks for the Reviews hub -----

export type ReviewPeriod = "7d" | "30d" | "90d" | "12m" | "all";

export type ReviewStoreStat = {
  store_id: string;
  reviews: number;
  avg_stars: number;
  response_rate: number;
  avg_reply_days: number | null;
  last_review_at: string | null;
  reviews_30d: number;
  avg_stars_30d: number | null;
  reviews_7d: number;
  avg_stars_7d: number | null;
};

export const useStoreReviewStats = () =>
  useQuery({
    queryKey: ["review-store-stats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("review_store_stats").select("*");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        store_id: r.store_id,
        reviews: Number(r.reviews ?? 0),
        avg_stars: Number(r.avg_stars ?? 0),
        response_rate: Number(r.response_rate ?? 0),
        avg_reply_days: r.avg_reply_days != null ? Number(r.avg_reply_days) : null,
        last_review_at: r.last_review_at,
        reviews_30d: Number(r.reviews_30d ?? 0),
        avg_stars_30d: r.avg_stars_30d != null ? Number(r.avg_stars_30d) : null,
        reviews_7d: Number(r.reviews_7d ?? 0),
        avg_stars_7d: r.avg_stars_7d != null ? Number(r.avg_stars_7d) : null,
      })) as ReviewStoreStat[];
    },
  });

// Trend: monthly volume + avg stars, last 24 months
export const useReviewTrend = (storeId?: string | null, months = 24) =>
  useQuery({
    queryKey: ["review-trend", storeId ?? "all", months],
    queryFn: async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - months);
      let q = supabase
        .from("google_reviews")
        .select("stars,published_at,response_text")
        .gte("published_at", since.toISOString());
      if (storeId) q = q.eq("store_id", storeId);
      // Pull in chunks (could be > 1000)
      const all: any[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await q.range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
      }
      const buckets = new Map<string, { count: number; sum: number; n: number; replied: number }>();
      for (const r of all) {
        if (!r.published_at) continue;
        const d = new Date(r.published_at);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        const b = buckets.get(key) ?? { count: 0, sum: 0, n: 0, replied: 0 };
        b.count++;
        if (r.stars != null) { b.sum += r.stars; b.n++; }
        if (r.response_text) b.replied++;
        buckets.set(key, b);
      }
      // Build full month range so empty months show
      const series: { month: string; label: string; count: number; avg: number; responseRate: number }[] = [];
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date();
        d.setUTCDate(1);
        d.setUTCMonth(d.getUTCMonth() - i);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        const b = buckets.get(key);
        series.push({
          month: key,
          label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
          count: b?.count ?? 0,
          avg: b?.n ? +(b.sum / b.n).toFixed(2) : 0,
          responseRate: b?.count ? +(b.replied / b.count).toFixed(2) : 0,
        });
      }
      return series;
    },
  });

// Response performance: % responded by star + median reply time per star
export const useResponsePerformance = (storeId?: string | null) =>
  useQuery({
    queryKey: ["review-response-perf", storeId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("google_reviews").select("stars,published_at,response_at,response_text");
      if (storeId) q = q.eq("store_id", storeId);
      const all: any[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await q.range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
      }
      const byStar: Record<number, { total: number; replied: number; replyDays: number[] }> = {
        1: { total: 0, replied: 0, replyDays: [] },
        2: { total: 0, replied: 0, replyDays: [] },
        3: { total: 0, replied: 0, replyDays: [] },
        4: { total: 0, replied: 0, replyDays: [] },
        5: { total: 0, replied: 0, replyDays: [] },
      };
      for (const r of all) {
        const s = r.stars;
        if (!s || s < 1 || s > 5) continue;
        byStar[s].total++;
        if (r.response_text) {
          byStar[s].replied++;
          if (r.published_at && r.response_at) {
            const days = (new Date(r.response_at).getTime() - new Date(r.published_at).getTime()) / 86400_000;
            if (days >= 0 && days < 365) byStar[s].replyDays.push(days);
          }
        }
      }
      const median = (arr: number[]) => {
        if (!arr.length) return null;
        const sorted = [...arr].sort((a, b) => a - b);
        const m = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
      };
      return [5, 4, 3, 2, 1].map((s) => ({
        star: s,
        total: byStar[s].total,
        replied: byStar[s].replied,
        responseRate: byStar[s].total ? byStar[s].replied / byStar[s].total : 0,
        medianReplyDays: median(byStar[s].replyDays),
      }));
    },
  });

export type ReviewInsight = {
  id: string;
  store_id: string | null;
  period: ReviewPeriod;
  generated_at: string;
  model: string | null;
  summary: string | null;
  themes_positive: { theme: string; count: number; example_quote: string; example_review_id?: string }[] | null;
  themes_negative: { theme: string; count: number; example_quote: string; example_review_id?: string }[] | null;
  action_items: { title: string; detail: string; priority: "low" | "medium" | "high" }[] | null;
  sample_size: number | null;
};

export const useReviewInsight = (storeId: string | null, period: ReviewPeriod) =>
  useQuery({
    queryKey: ["review-insight", storeId ?? "all", period],
    queryFn: async () => {
      let q = (supabase as any).from("review_insights").select("*").eq("period", period).order("generated_at", { ascending: false }).limit(1);
      q = storeId ? q.eq("store_id", storeId) : q.is("store_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return (data?.[0] ?? null) as ReviewInsight | null;
    },
  });

export const useGenerateInsight = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { storeId: string | null; period: ReviewPeriod; force?: boolean }) => {
      const { data, error } = await supabase.functions.invoke("analyze-reviews", { body: args });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { insight: ReviewInsight; cached: boolean };
    },
    onSuccess: (d, vars) => {
      if (d.cached) toast.success("Loaded cached insights (< 24h old)");
      else toast.success("Insights generated");
      qc.invalidateQueries({ queryKey: ["review-insight", vars.storeId ?? "all", vars.period] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to generate insights"),
  });
};

// Update google_places.store_id manually (used in Manage Links tab)
export const useUpdatePlaceStore = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ placeId, storeId }: { placeId: string; storeId: string | null }) => {
      const { error } = await (supabase as any)
        .from("google_places")
        .update({ store_id: storeId })
        .eq("place_id", placeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Store link updated");
      qc.invalidateQueries({ queryKey: ["google-places"] });
      qc.invalidateQueries({ queryKey: ["google-reviews"] });
      qc.invalidateQueries({ queryKey: ["review-store-stats"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update link"),
  });
};

