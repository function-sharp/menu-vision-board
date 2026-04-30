// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FIRECRAWL_API = "https://api.firecrawl.dev/v2";

type Action =
  | "find_store_url"
  | "scrape_store_metadata"
  | "scrape_item_links"
  | "validate_url";

type Provider = "firecrawl" | "apify";

interface Body {
  action: Action;
  provider?: Provider;
  payload: { store_id?: string; item_id?: string };
}

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

async function firecrawlSearch(query: string, limit = 5) {
  const FIRECRAWL_API_KEY = getEnv("FIRECRAWL_API_KEY");
  const res = await fetch(`${FIRECRAWL_API}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, limit }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Firecrawl search failed [${res.status}]: ${JSON.stringify(data)}`);
  return data;
}

async function firecrawlScrape(url: string, formats: any[], extra: Record<string, unknown> = {}) {
  const FIRECRAWL_API_KEY = getEnv("FIRECRAWL_API_KEY");
  const res = await fetch(`${FIRECRAWL_API}/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats, onlyMainContent: true, ...extra }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Firecrawl scrape failed [${res.status}]: ${JSON.stringify(data)}`);
  return data;
}

function pickUberEatsLink(payload: any): string | null {
  // Firecrawl v2 search may return results under data, web, or as array
  const candidates: any[] = [];
  if (Array.isArray(payload?.data)) candidates.push(...payload.data);
  if (Array.isArray(payload?.web)) candidates.push(...payload.web);
  if (Array.isArray(payload?.results?.web)) candidates.push(...payload.results.web);
  if (Array.isArray(payload?.data?.web)) candidates.push(...payload.data.web);
  for (const r of candidates) {
    const url: string | undefined = r?.url || r?.link;
    if (typeof url === "string" && /ubereats\.com\/.*\/store\//i.test(url)) {
      return url.split("?")[0];
    }
  }
  // fallback: any ubereats.com url
  for (const r of candidates) {
    const url: string | undefined = r?.url || r?.link;
    if (typeof url === "string" && /ubereats\.com/i.test(url)) return url.split("?")[0];
  }
  return null;
}

function getMarkdown(payload: any): string {
  return payload?.markdown ?? payload?.data?.markdown ?? "";
}
function getLinks(payload: any): string[] {
  return payload?.links ?? payload?.data?.links ?? [];
}
function getJson(payload: any): any {
  return payload?.json ?? payload?.data?.json ?? null;
}
function getStatus(payload: any): number | null {
  return (
    payload?.metadata?.statusCode ??
    payload?.data?.metadata?.statusCode ??
    null
  );
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function fuzzyMatchItemUrl(itemName: string, links: string[]): string | null {
  const target = normalize(itemName);
  if (!target) return null;
  const itemLinks = links.filter((l) => /ubereats\.com\/.*\/(store|item)\//i.test(l));
  let best: { url: string; score: number } | null = null;
  for (const link of itemLinks) {
    const tail = decodeURIComponent(link.split("/").pop() || "");
    const slug = normalize(tail);
    if (!slug) continue;
    // simple containment scoring
    let score = 0;
    if (slug.includes(target)) score = target.length;
    else {
      const tokens = target.split(" ").filter((t) => t.length > 2);
      score = tokens.reduce((acc, t) => acc + (slug.includes(t) ? t.length : 0), 0);
    }
    if (!best || score > best.score) best = { url: link, score };
  }
  if (!best || best.score < Math.max(4, target.length / 3)) return null;
  return best.url.split("?")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const action = body?.action;
  const provider: Provider = body?.provider ?? "firecrawl";
  const payload = body?.payload ?? {};
  if (!action) return json(400, { error: "Missing action" });

  if (provider === "apify") {
    return json(501, { error: "Apify provider not implemented yet" });
  }

  const SUPABASE_URL = getEnv("SUPABASE_URL");
  const SERVICE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supa = createClient(SUPABASE_URL, SERVICE_KEY);

  const targetType = payload.item_id ? "item" : "store";
  const targetId = payload.item_id ?? payload.store_id;
  if (!targetId) return json(400, { error: "Missing target id" });

  const { data: jobRow } = await supa
    .from("scrape_jobs")
    .insert({ action, provider, target_type: targetType, target_id: targetId, status: "running" })
    .select("id")
    .single();
  const jobId = jobRow?.id;

  const finish = async (status: "success" | "error", result: unknown, error?: string) => {
    if (jobId) {
      await supa
        .from("scrape_jobs")
        .update({ status, result: result as any, error: error ?? null, finished_at: new Date().toISOString() })
        .eq("id", jobId);
    }
  };

  try {
    if (action === "find_store_url") {
      const { data: store, error } = await supa
        .from("stores")
        .select("id, name, address, store_group")
        .eq("id", payload.store_id!)
        .single();
      if (error || !store) throw new Error("Store not found");
      const q = [store.name, store.address, "site:ubereats.com"].filter(Boolean).join(" ");
      const search = await firecrawlSearch(q, 8);
      const url = pickUberEatsLink(search);
      if (!url) {
        await finish("error", { search }, "No Uber Eats URL found");
        return json(200, { ok: false, error: "No Uber Eats URL found" });
      }
      await supa.from("stores").update({ uber_eats_url: url }).eq("id", store.id);
      await finish("success", { url });
      return json(200, { ok: true, url });
    }

    if (action === "scrape_store_metadata") {
      const { data: store, error } = await supa
        .from("stores")
        .select("id, name, uber_eats_url")
        .eq("id", payload.store_id!)
        .single();
      if (error || !store) throw new Error("Store not found");
      if (!store.uber_eats_url) throw new Error("Store has no uber_eats_url");
      const schema = {
        type: "object",
        properties: {
          rating: { type: "number" },
          rating_count: { type: "number" },
          price_range: { type: "string" },
          address: { type: "string" },
          cuisine: { type: "string" },
        },
      };
      const scraped = await firecrawlScrape(store.uber_eats_url, [
        { type: "json", schema, prompt: "Extract restaurant rating, number of ratings, price range (e.g. $, $$), address, and cuisine type." },
      ]);
      const j = getJson(scraped) || {};
      const update: Record<string, unknown> = {};
      if (typeof j.rating === "number") update.rating = j.rating;
      if (typeof j.rating_count === "number") update.rating_count = j.rating_count;
      if (typeof j.price_range === "string") update.price_range = j.price_range;
      if (typeof j.address === "string") update.address = j.address;
      if (typeof j.cuisine === "string") update.cuisine = j.cuisine;
      if (Object.keys(update).length > 0) {
        await supa.from("stores").update(update).eq("id", store.id);
      }
      await finish("success", { extracted: j, applied: update });
      return json(200, { ok: true, applied: update });
    }

    if (action === "scrape_item_links") {
      const { data: store, error } = await supa
        .from("stores")
        .select("id, uber_eats_url")
        .eq("id", payload.store_id!)
        .single();
      if (error || !store) throw new Error("Store not found");
      if (!store.uber_eats_url) throw new Error("Store has no uber_eats_url");

      const scraped = await firecrawlScrape(store.uber_eats_url, ["links", "markdown"], {
        onlyMainContent: false,
      });
      const links = getLinks(scraped);

      const { data: items, error: itemsErr } = await supa
        .from("menu_items")
        .select("id, name, deep_link")
        .eq("store_id", store.id);
      if (itemsErr) throw itemsErr;

      let matched = 0;
      for (const item of items ?? []) {
        if (item.deep_link) continue;
        const url = fuzzyMatchItemUrl(item.name, links);
        if (url) {
          await supa.from("menu_items").update({ deep_link: url }).eq("id", item.id);
          matched++;
        }
      }
      await finish("success", { total: items?.length ?? 0, matched, link_count: links.length });
      return json(200, { ok: true, matched, total: items?.length ?? 0 });
    }

    if (action === "validate_url") {
      let urlToCheck: string | null = null;
      let nameHint = "";
      if (payload.item_id) {
        const { data: item } = await supa
          .from("menu_items")
          .select("id, name, deep_link, stores!inner(name)")
          .eq("id", payload.item_id)
          .single();
        urlToCheck = item?.deep_link ?? null;
        nameHint = item?.name ?? "";
      } else if (payload.store_id) {
        const { data: store } = await supa
          .from("stores")
          .select("id, name, uber_eats_url")
          .eq("id", payload.store_id)
          .single();
        urlToCheck = store?.uber_eats_url ?? null;
        nameHint = store?.name ?? "";
      }
      if (!urlToCheck) throw new Error("No URL stored to validate");
      const scraped = await firecrawlScrape(urlToCheck, ["markdown"], { onlyMainContent: false });
      const status = getStatus(scraped);
      const md = getMarkdown(scraped).toLowerCase();
      const ok = (status == null || (status >= 200 && status < 400)) && (!nameHint || md.includes(nameHint.toLowerCase().split(" ")[0]));
      const result = { url: urlToCheck, status, name_match: nameHint ? md.includes(nameHint.toLowerCase().split(" ")[0]) : null };
      await finish(ok ? "success" : "error", result, ok ? undefined : "Validation failed");
      return json(200, { ok, ...result });
    }

    await finish("error", null, `Unknown action: ${action}`);
    return json(400, { error: `Unknown action: ${action}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("scrape-uber-eats error:", msg);
    await finish("error", null, msg);
    return json(500, { error: msg });
  }
});
