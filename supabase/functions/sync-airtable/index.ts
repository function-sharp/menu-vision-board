// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/airtable";
const BASE_ID = "appGQEVbE8o5NRK1K"; // Col'Cacchio OS
const STORES_TABLE = "Stores";
const PROMOS_TABLE = "Promotion Tracker";
const STORE_URL_FIELD = "Uber Eats URL (from Master Store)";

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

async function airtablePatch(
  table: string,
  records: { id: string; fields: Record<string, unknown> }[],
  lovableKey: string,
  airtableKey: string,
) {
  const results: { ok: number; failed: { id: string; error: string }[] } = { ok: 0, failed: [] };
  for (let i = 0; i < records.length; i += 10) {
    const chunk = records.slice(i, i + 10);
    const res = await fetch(`${GATEWAY_URL}/v0/${BASE_ID}/${encodeURIComponent(table)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": airtableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ records: chunk }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = `[${res.status}] ${JSON.stringify(data)}`;
      for (const r of chunk) results.failed.push({ id: r.id, error: errMsg });
    } else {
      results.ok += (data.records ?? []).length;
    }
  }
  return results;
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
function isBlank(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

async function logRun(
  sb: any,
  direction: string,
  source: string,
  status: string,
  summary: unknown,
  error?: string,
) {
  await sb.from("sync_runs").insert({
    direction,
    source,
    status,
    summary: summary as any,
    error: error ?? null,
    finished_at: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: { direction?: "pull" | "push" } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const direction = body.direction ?? "pull";

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const AIRTABLE_API_KEY = Deno.env.get("AIRTABLE_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!LOVABLE_API_KEY || !AIRTABLE_API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing required environment variables" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    if (direction === "pull") {
      // ---- PULL: Airtable -> Supabase, NULL-only on stores; full upsert on promotions ----
      const storeRecs = await airtableFetch(STORES_TABLE, LOVABLE_API_KEY, AIRTABLE_API_KEY);
      const { data: dbStores, error: dbErr } = await sb
        .from("stores")
        .select("id, name, uber_eats_url");
      if (dbErr) throw dbErr;

      const dbByNorm = new Map<string, { id: string; name: string; uber_eats_url: string | null }>();
      for (const s of dbStores ?? []) dbByNorm.set(normaliseName(s.name), s);

      let storesFilled = 0;
      let storesSkippedSupabaseWins = 0;
      const unmatched: string[] = [];

      for (const r of storeRecs) {
        const f = r.fields ?? {};
        const nameKey = Object.keys(f).find((k) => k.replace(/^\uFEFF/, "") === "Store");
        const urlKey = Object.keys(f).find((k) => k.includes("Uber Eats URL"));
        const rawName = nameKey ? String(f[nameKey] ?? "") : "";
        const url = urlKey ? f[urlKey] : null;
        if (!rawName || !url) continue;
        const norm = normaliseName(rawName);
        let match = dbByNorm.get(norm);
        if (!match) {
          for (const [k, v] of dbByNorm) {
            if (k.includes(norm) || norm.includes(k)) { match = v; break; }
          }
        }
        if (!match) {
          unmatched.push(rawName);
          continue;
        }
        if (!isBlank(match.uber_eats_url)) {
          storesSkippedSupabaseWins++;
          continue;
        }
        await sb.from("stores").update({ uber_eats_url: String(url) }).eq("id", match.id);
        storesFilled++;
      }

      // Promotions: Airtable owns this — full upsert + delete missing
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
        const { error: upErr } = await sb
          .from("promotions")
          .upsert(upserts, { onConflict: "airtable_id" });
        if (upErr) throw upErr;
        promotionsUpserted = upserts.length;
      }

      const liveIds = new Set(promoRecs.map((r) => r.id));
      const { data: existing } = await sb.from("promotions").select("id, airtable_id");
      const stale = (existing ?? []).filter((p: any) => !liveIds.has(p.airtable_id));
      let promotionsRemoved = 0;
      if (stale.length) {
        const { error: delErr } = await sb
          .from("promotions")
          .delete()
          .in("id", stale.map((s: any) => s.id));
        if (delErr) throw delErr;
        promotionsRemoved = stale.length;
      }

      const summary = {
        stores_filled: storesFilled,
        stores_skipped_supabase_wins: storesSkippedSupabaseWins,
        stores_unmatched: unmatched,
        promotions_upserted: promotionsUpserted,
        promotions_removed: promotionsRemoved,
      };

      await sb.from("uploads").insert({
        filename: "Airtable pull",
        store_count: storesFilled,
        item_count: promotionsUpserted,
        note: `Pull: ${storesFilled} filled, ${storesSkippedSupabaseWins} kept (Supabase wins), ${unmatched.length} unmatched; promos ${promotionsUpserted}↑/${promotionsRemoved}↓`,
        source: "airtable",
      });
      await logRun(sb, "pull", "airtable", "success", summary);

      return new Response(JSON.stringify({ ok: true, ...summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (direction === "push") {
      // ---- PUSH: Supabase -> Airtable for stores with manual edits or values ----
      const { data: dbStores, error: dbErr } = await sb
        .from("stores")
        .select("id, name, uber_eats_url, manually_edited_at")
        .not("uber_eats_url", "is", null);
      if (dbErr) throw dbErr;

      const storeRecs = await airtableFetch(STORES_TABLE, LOVABLE_API_KEY, AIRTABLE_API_KEY);
      const airtableByNorm = new Map<string, { id: string; currentUrl: string | null }>();
      for (const r of storeRecs) {
        const f = r.fields ?? {};
        const nameKey = Object.keys(f).find((k) => k.replace(/^\uFEFF/, "") === "Store");
        const urlKey = Object.keys(f).find((k) => k.includes("Uber Eats URL"));
        const rawName = nameKey ? String(f[nameKey] ?? "") : "";
        const currentUrl = urlKey ? (f[urlKey] as string | null) : null;
        if (rawName) airtableByNorm.set(normaliseName(rawName), { id: r.id, currentUrl });
      }

      const toPatch: { id: string; fields: Record<string, unknown> }[] = [];
      const notFound: string[] = [];
      let alreadyMatching = 0;

      for (const s of dbStores ?? []) {
        const at = airtableByNorm.get(normaliseName(s.name));
        if (!at) {
          let fuzzy: { id: string; currentUrl: string | null } | undefined;
          const target = normaliseName(s.name);
          for (const [k, v] of airtableByNorm) {
            if (k.includes(target) || target.includes(k)) { fuzzy = v; break; }
          }
          if (!fuzzy) { notFound.push(s.name); continue; }
          if (fuzzy.currentUrl === s.uber_eats_url) { alreadyMatching++; continue; }
          toPatch.push({ id: fuzzy.id, fields: { [STORE_URL_FIELD]: s.uber_eats_url } });
        } else {
          if (at.currentUrl === s.uber_eats_url) { alreadyMatching++; continue; }
          toPatch.push({ id: at.id, fields: { [STORE_URL_FIELD]: s.uber_eats_url } });
        }
      }

      const result = toPatch.length
        ? await airtablePatch(STORES_TABLE, toPatch, LOVABLE_API_KEY, AIRTABLE_API_KEY)
        : { ok: 0, failed: [] };

      const summary = {
        stores_pushed: result.ok,
        stores_unchanged: alreadyMatching,
        stores_not_found_in_airtable: notFound,
        push_errors: result.failed,
        attempted: toPatch.length,
      };

      const status = result.failed.length === 0 ? "success" : "error";
      const errStr = result.failed.length
        ? `${result.failed.length} record(s) failed (often: field is a lookup/computed and can't be written). First error: ${result.failed[0].error}`
        : undefined;

      await sb.from("uploads").insert({
        filename: "Airtable push",
        store_count: result.ok,
        item_count: 0,
        note: `Push: ${result.ok} updated, ${alreadyMatching} unchanged, ${notFound.length} not in Airtable, ${result.failed.length} failed`,
        source: "airtable",
      });
      await logRun(sb, "push", "airtable", status, summary, errStr);

      return new Response(JSON.stringify({ ok: status === "success", ...summary, error: errStr }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ ok: false, error: `Unknown direction: ${direction}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("sync-airtable error:", msg);
    await logRun(sb, direction, "airtable", "error", null, msg).catch(() => {});
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
