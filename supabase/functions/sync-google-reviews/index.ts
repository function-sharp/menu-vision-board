import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const APIFY_TOKEN = Deno.env.get("APIFY_TOKEN")!;
const APIFY_DATASET_ID = "bg5J0WsBCpIhuxNDp";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ApifyReview {
  reviewId: string;
  reviewerId?: string;
  name?: string;
  reviewerNumberOfReviews?: number;
  isLocalGuide?: boolean;
  reviewerPhotoUrl?: string;
  text?: string | null;
  textTranslated?: string | null;
  publishAt?: string | null;
  publishedAtDate?: string | null;
  likesCount?: number;
  reviewUrl?: string;
  stars?: number | null;
  responseFromOwnerDate?: string | null;
  responseFromOwnerText?: string | null;
  reviewImageUrls?: string[];
  reviewDetailedRating?: { Food?: number; Service?: number; Atmosphere?: number } | null;
  originalLanguage?: string | null;
  placeId: string;
  title?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  countryCode?: string;
  location?: { lat?: number; lng?: number };
  totalScore?: number | null;
  reviewsCount?: number | null;
  url?: string;
  cid?: string;
  fid?: string;
  kgmid?: string;
  categoryName?: string;
}

async function fetchPage(offset: number, limit: number): Promise<ApifyReview[]> {
  const url = `https://api.apify.com/v2/datasets/${APIFY_DATASET_ID}/items?token=${APIFY_TOKEN}&offset=${offset}&limit=${limit}&clean=true`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Apify ${r.status}: ${await r.text()}`);
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startedAt = new Date().toISOString();

  // Create sync run row
  const { data: runRow } = await supabase
    .from("sync_runs")
    .insert({ source: "apify-google-reviews", direction: "in", status: "running" })
    .select()
    .single();
  const runId = runRow?.id;

  try {
    // Load existing stores once for matching
    const { data: stores } = await supabase.from("stores").select("id, name, slug");
    const matchStore = (title: string | undefined): string | null => {
      if (!title || !stores) return null;
      const t = title.toLowerCase();
      const found = stores.find((s) => t.includes(s.slug.toLowerCase()) || t.includes(s.name.toLowerCase()));
      return found?.id ?? null;
    };

    const placesMap = new Map<string, any>();
    const reviewsBatch: any[] = [];
    const PAGE = 1000;
    let offset = 0;
    let total = 0;

    while (true) {
      const items = await fetchPage(offset, PAGE);
      if (!items.length) break;
      total += items.length;

      for (const r of items) {
        if (!r.placeId || !r.reviewId) continue;
        if (!placesMap.has(r.placeId)) {
          placesMap.set(r.placeId, {
            place_id: r.placeId,
            store_id: matchStore(r.title),
            title: r.title ?? r.placeId,
            address: r.address ?? null,
            city: r.city ?? null,
            postal_code: r.postalCode ?? null,
            country_code: r.countryCode ?? null,
            lat: r.location?.lat ?? null,
            lng: r.location?.lng ?? null,
            total_score: r.totalScore ?? null,
            reviews_count: r.reviewsCount ?? null,
            url: r.url ?? null,
            cid: r.cid ?? null,
            fid: r.fid ?? null,
            kgmid: r.kgmid ?? null,
            category_name: r.categoryName ?? null,
            last_synced_at: startedAt,
          });
        }
        reviewsBatch.push({
          review_id: r.reviewId,
          place_id: r.placeId,
          store_id: matchStore(r.title),
          reviewer_id: r.reviewerId ?? null,
          reviewer_name: r.name ?? null,
          reviewer_photo_url: r.reviewerPhotoUrl ?? null,
          reviewer_review_count: r.reviewerNumberOfReviews ?? null,
          is_local_guide: r.isLocalGuide ?? null,
          stars: r.stars ?? null,
          text: r.text ?? null,
          text_translated: r.textTranslated ?? null,
          original_language: r.originalLanguage ?? null,
          published_at: r.publishedAtDate ?? null,
          publish_at_label: r.publishAt ?? null,
          likes_count: r.likesCount ?? 0,
          response_text: r.responseFromOwnerText ?? null,
          response_at: r.responseFromOwnerDate ?? null,
          detailed_food: r.reviewDetailedRating?.Food ?? null,
          detailed_service: r.reviewDetailedRating?.Service ?? null,
          detailed_atmosphere: r.reviewDetailedRating?.Atmosphere ?? null,
          review_url: r.reviewUrl ?? null,
          image_urls: r.reviewImageUrls ?? [],
        });
      }

      if (items.length < PAGE) break;
      offset += PAGE;
    }

    // Upsert places
    if (placesMap.size > 0) {
      const placesArr = Array.from(placesMap.values());
      const { error } = await supabase.from("google_places").upsert(placesArr, { onConflict: "place_id" });
      if (error) throw error;
    }

    // Upsert reviews in chunks
    const CHUNK = 500;
    let upserted = 0;
    for (let i = 0; i < reviewsBatch.length; i += CHUNK) {
      const slice = reviewsBatch.slice(i, i + CHUNK);
      const { error } = await supabase.from("google_reviews").upsert(slice, { onConflict: "review_id" });
      if (error) throw error;
      upserted += slice.length;
    }

    const summary = { total, upserted, places: placesMap.size };

    if (runId) {
      await supabase
        .from("sync_runs")
        .update({ status: "success", finished_at: new Date().toISOString(), summary })
        .eq("id", runId);
    }

    await supabase.from("activity_log").insert({
      action: "reviews.sync",
      entity_type: "google_reviews",
      entity_label: `Apify ${APIFY_DATASET_ID}`,
      details: summary,
    });

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (runId) {
      await supabase
        .from("sync_runs")
        .update({ status: "error", finished_at: new Date().toISOString(), error: msg })
        .eq("id", runId);
    }
    await supabase.from("activity_log").insert({
      action: "reviews.sync.failed",
      entity_type: "google_reviews",
      details: { error: msg },
    });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
