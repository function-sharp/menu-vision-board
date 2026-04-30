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
