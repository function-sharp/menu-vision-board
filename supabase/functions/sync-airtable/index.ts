import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/airtable";
const BASE_ID = "appGQEVbE8o5NRK1K"; // Col'Cacchio OS
const STORES_TABLE = "Stores";
const PROMOS_TABLE = "Promotion Tracker";

function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/['’`]/g, "")
    .replace(/[,\-–—()]/g, " ")
    .replace(/\bcol\s*cacchio\b/g, "colcacchio")
    .replace(/\bgo\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function airtableFetch(table: string, lovableKey: string, airtableKey: string) {
  const records: any[] = [];
  let offset: string | undefined = undefined;
  do {
    const url = new URL(`${GATEWAY_URL}/v0/${BASE_ID}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": airtableKey,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Airtable ${table} fetch failed [${res.status}]: ${body}`);
    }
    const json = await res.json();
    records.push(...(json.records ?? []));
    offset = json.offset;
  } while (offset);
  return records;
}

function asString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}
function asArray(v: unknown): string[] | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === "string") return [v];
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const AIRTABLE_API_KEY = Deno.env.get("AIRTABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!AIRTABLE_API_KEY) throw new Error("AIRTABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // ---- Stores: update uber_eats_url ----
    const storeRecs = await airtableFetch(STORES_TABLE, LOVABLE_API_KEY, AIRTABLE_API_KEY);
    const { data: dbStores, error: dbErr } = await sb.from("stores").select("id, name");
    if (dbErr) throw dbErr;

    const dbByNorm = new Map<string, { id: string; name: string }>();
    for (const s of dbStores ?? []) dbByNorm.set(normaliseName(s.name), s);

    let storesUpdated = 0;
    const unmatched: string[] = [];
    for (const r of storeRecs) {
      const f = r.fields ?? {};
      // Field names include a leading BOM in some cases, find by suffix.
      const nameKey = Object.keys(f).find((k) => k.replace(/^\uFEFF/, "") === "Store");
      const urlKey = Object.keys(f).find((k) => k.includes("Uber Eats URL"));
      const rawName = nameKey ? String(f[nameKey] ?? "") : "";
      const url = urlKey ? f[urlKey] : null;
      if (!rawName || !url) continue;
      const norm = normaliseName(rawName);
      const match = dbByNorm.get(norm);
      if (!match) {
        // Fuzzy: contains-match either direction
        let fuzzy: { id: string; name: string } | undefined;
        for (const [k, v] of dbByNorm) {
          if (k.includes(norm) || norm.includes(k)) { fuzzy = v; break; }
        }
        if (!fuzzy) { unmatched.push(rawName); continue; }
        await sb.from("stores").update({ uber_eats_url: String(url) }).eq("id", fuzzy.id);
        storesUpdated++;
      } else {
        await sb.from("stores").update({ uber_eats_url: String(url) }).eq("id", match.id);
        storesUpdated++;
      }
    }

    // ---- Promotions: upsert + delete missing ----
    const promoRecs = await airtableFetch(PROMOS_TABLE, LOVABLE_API_KEY, AIRTABLE_API_KEY);
    const upserts = promoRecs.map((r) => {
      const f = r.fields ?? {};
      return {
        airtable_id: r.id,
        promo_id: asString(f["Promo ID"]),
        month: asString(f["Month"]),
        week: asString(f["Week"]),
        start_date: asString(f["Start Date"]),
        end_date: asString(f["End Date"]),
        date_range_original: asString(f["Date Range (Original)"]),
        theme: asArray(f["Theme"]),
        store_group: asString(f["Store Group"]),
        offer_type: asString(f["Offer Type"]),
        messaging: asString(f["Messaging"]),
        mechanic: asString(f["Mechanic"]),
        recommended_items: asArray(f["Recommended Items"]),
        audience: asString(f["Audience"]),
        funding_split: asString(f["Funding Split"]),
        status: asString(f["Status"]),
        rationale: asString(f["Rationale"]),
        margin_check: asString(f["Margin Check"]),
        priority: asString(f["Priority"]),
        marketing_approval: asString(f["Marketing Approval"]),
        operations_approval: asString(f["Operations Approval"]),
        synced_at: new Date().toISOString(),
      };
    });

    let promotionsUpserted = 0;
    if (upserts.length) {
      const { error: upErr } = await sb.from("promotions").upsert(upserts, { onConflict: "airtable_id" });
      if (upErr) throw upErr;
      promotionsUpserted = upserts.length;
    }

    const liveIds = new Set(promoRecs.map((r) => r.id));
    const { data: existing } = await sb.from("promotions").select("id, airtable_id");
    const stale = (existing ?? []).filter((p: any) => !liveIds.has(p.airtable_id));
    let promotionsRemoved = 0;
    if (stale.length) {
      const { error: delErr } = await sb.from("promotions").delete().in("id", stale.map((s: any) => s.id));
      if (delErr) throw delErr;
      promotionsRemoved = stale.length;
    }

    await sb.from("uploads").insert({
      filename: "Airtable: Col'Cacchio OS",
      store_count: storesUpdated,
      item_count: promotionsUpserted,
      note: `Stores updated: ${storesUpdated}${unmatched.length ? `, unmatched: ${unmatched.length}` : ""}; promotions upserted: ${promotionsUpserted}, removed: ${promotionsRemoved}`,
      source: "airtable",
    });

    return new Response(
      JSON.stringify({
        ok: true,
        stores_updated: storesUpdated,
        stores_unmatched: unmatched,
        promotions_upserted: promotionsUpserted,
        promotions_removed: promotionsRemoved,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("sync-airtable error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
