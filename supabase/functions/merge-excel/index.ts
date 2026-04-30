// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ExcelRow {
  store_name?: string;
  group?: string | null;
  cuisine?: string | null;
  rating?: number | string | null;
  rating_count?: number | string | null;
  telephone?: string | null;
  address?: string | null;
  price_range?: string | null;
  store_url?: string | null;
  category?: string | null;
  item_name?: string;
  item_description?: string | null;
  item_price?: number | string | null;
  item_currency?: string | null;
  item_deep_link?: string | null;
}

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || v === "" || (typeof v === "number" && Number.isNaN(v));
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing Supabase env vars" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: { rows: ExcelRow[]; filename?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: "No rows provided" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startedAt = new Date().toISOString();

  try {
    // ---- Build incoming store map ----
    const incomingStores = new Map<string, any>();
    for (const r of rows) {
      const name = String(r.store_name ?? "").trim();
      if (!name) continue;
      if (!incomingStores.has(name)) {
        incomingStores.set(name, {
          name,
          slug: slugify(name),
          store_group: r.group ?? null,
          cuisine: r.cuisine ?? null,
          rating: !isBlank(r.rating) ? Number(r.rating) : null,
          rating_count: !isBlank(r.rating_count) ? Number(r.rating_count) : null,
          telephone: !isBlank(r.telephone) ? String(r.telephone) : null,
          address: r.address ?? null,
          price_range: r.price_range ?? null,
          store_url: r.store_url ?? null,
          item_count: 0,
        });
      }
      incomingStores.get(name).item_count++;
    }

    // ---- Fetch existing stores by slug ----
    const slugs = Array.from(incomingStores.values()).map((s) => s.slug);
    const { data: existingStores, error: exErr } = await sb
      .from("stores")
      .select("id, slug, name, store_group, cuisine, rating, rating_count, telephone, address, price_range, store_url");
    if (exErr) throw exErr;
    const existingBySlug = new Map<string, any>();
    for (const s of existingStores ?? []) existingBySlug.set(s.slug, s);

    let storesInserted = 0;
    let storesMerged = 0;
    const storeIdByName = new Map<string, string>();

    const MERGE_FIELDS = ["store_group", "cuisine", "rating", "rating_count", "telephone", "address", "price_range", "store_url"];

    for (const incoming of incomingStores.values()) {
      const existing = existingBySlug.get(incoming.slug);
      if (!existing) {
        const { data: ins, error } = await sb
          .from("stores")
          .insert({
            name: incoming.name,
            slug: incoming.slug,
            store_group: incoming.store_group,
            cuisine: incoming.cuisine,
            rating: incoming.rating,
            rating_count: incoming.rating_count,
            telephone: incoming.telephone,
            address: incoming.address,
            price_range: incoming.price_range,
            store_url: incoming.store_url,
            item_count: incoming.item_count,
          })
          .select("id")
          .single();
        if (error) throw error;
        storeIdByName.set(incoming.name, ins.id);
        storesInserted++;
      } else {
        // NULL-only merge for protected fields; always update name + item_count
        const update: Record<string, unknown> = {
          name: incoming.name,
          item_count: incoming.item_count,
        };
        for (const f of MERGE_FIELDS) {
          if (isBlank(existing[f]) && !isBlank(incoming[f])) update[f] = incoming[f];
        }
        await sb.from("stores").update(update).eq("id", existing.id);
        storeIdByName.set(incoming.name, existing.id);
        storesMerged++;
      }
    }

    // ---- Items: upsert by (store_id, name), NULL-only merge ----
    const ITEM_MERGE_FIELDS = ["category", "description", "price", "currency", "deep_link"];

    // Pull all existing items for affected stores
    const storeIds = Array.from(storeIdByName.values());
    const { data: existingItems, error: eiErr } = await sb
      .from("menu_items")
      .select("id, store_id, name, category, description, price, currency, deep_link")
      .in("store_id", storeIds);
    if (eiErr) throw eiErr;
    const existingItemKey = (storeId: string, name: string) => `${storeId}::${name.toLowerCase().trim()}`;
    const existingItemMap = new Map<string, any>();
    for (const it of existingItems ?? []) existingItemMap.set(existingItemKey(it.store_id, it.name), it);

    let itemsInserted = 0;
    let itemsMerged = 0;
    const toInsert: any[] = [];

    for (const r of rows) {
      const sName = String(r.store_name ?? "").trim();
      const iName = String(r.item_name ?? "").trim();
      if (!sName || !iName) continue;
      const storeId = storeIdByName.get(sName);
      if (!storeId) continue;
      const existing = existingItemMap.get(existingItemKey(storeId, iName));
      const incoming = {
        store_id: storeId,
        name: iName,
        category: r.category ?? null,
        description: r.item_description ?? null,
        price: !isBlank(r.item_price) ? Number(r.item_price) : null,
        currency: r.item_currency ?? "ZAR",
        deep_link: r.item_deep_link ?? null,
      };
      if (!existing) {
        toInsert.push(incoming);
      } else {
        const update: Record<string, unknown> = {};
        for (const f of ITEM_MERGE_FIELDS) {
          if (isBlank(existing[f]) && !isBlank((incoming as any)[f])) update[f] = (incoming as any)[f];
        }
        if (Object.keys(update).length > 0) {
          await sb.from("menu_items").update(update).eq("id", existing.id);
        }
        itemsMerged++;
      }
    }

    const chunkSize = 500;
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const chunk = toInsert.slice(i, i + chunkSize);
      const { error } = await sb.from("menu_items").insert(chunk);
      if (error) throw error;
      itemsInserted += chunk.length;
    }

    const itemsKept = (existingItems?.length ?? 0) - itemsMerged;

    const summary = {
      stores_inserted: storesInserted,
      stores_merged: storesMerged,
      items_inserted: itemsInserted,
      items_merged: itemsMerged,
      items_kept_untouched: Math.max(0, itemsKept),
    };

    await sb.from("uploads").insert({
      filename: body.filename ?? "Excel merge",
      store_count: storesInserted + storesMerged,
      item_count: itemsInserted + itemsMerged,
      note: body.note ?? `Merge: ${storesInserted}+${storesMerged} stores, ${itemsInserted}+${itemsMerged} items, ${itemsKept} kept`,
      source: "excel",
    });
    await sb.from("sync_runs").insert({
      direction: "merge",
      source: "excel",
      status: "success",
      summary: summary as any,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("merge-excel error:", msg);
    await sb.from("sync_runs").insert({
      direction: "merge",
      source: "excel",
      status: "error",
      error: msg,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
