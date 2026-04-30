import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

type Period = "7d" | "30d" | "90d" | "12m" | "all";

function periodToInterval(p: Period): string | null {
  switch (p) {
    case "7d": return "7 days";
    case "30d": return "30 days";
    case "90d": return "90 days";
    case "12m": return "365 days";
    default: return null;
  }
}

const ANALYZE_TOOL = {
  type: "function",
  function: {
    name: "report_review_insights",
    description: "Return structured insights extracted from customer reviews.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "2-3 sentence executive summary." },
        themes_positive: {
          type: "array",
          description: "Top recurring positive themes, ordered by frequency. Provide 3-6 entries.",
          items: {
            type: "object",
            properties: {
              theme: { type: "string" },
              count: { type: "integer" },
              example_quote: { type: "string" },
              example_review_id: { type: "string", description: "review_id of the quoted review" },
            },
            required: ["theme", "count", "example_quote"],
            additionalProperties: false,
          },
        },
        themes_negative: {
          type: "array",
          description: "Top recurring negative or concerning themes, ordered by severity / frequency. Provide 3-6 entries.",
          items: {
            type: "object",
            properties: {
              theme: { type: "string" },
              count: { type: "integer" },
              example_quote: { type: "string" },
              example_review_id: { type: "string" },
            },
            required: ["theme", "count", "example_quote"],
            additionalProperties: false,
          },
        },
        action_items: {
          type: "array",
          description: "Concrete, prioritised action items the operations team should consider. 3-5 entries.",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              detail: { type: "string" },
              priority: { type: "string", enum: ["low", "medium", "high"] },
            },
            required: ["title", "detail", "priority"],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "themes_positive", "themes_negative", "action_items"],
      additionalProperties: false,
    },
  },
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const storeId: string | null = body?.storeId ?? null;
    const period: Period = (body?.period ?? "90d") as Period;
    const force: boolean = !!body?.force;

    if (!["7d", "30d", "90d", "12m", "all"].includes(period)) {
      return new Response(JSON.stringify({ error: "Invalid period" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Cache check (24h)
    if (!force) {
      let q = supabase.from("review_insights").select("*").eq("period", period).order("generated_at", { ascending: false }).limit(1);
      q = storeId ? q.eq("store_id", storeId) : q.is("store_id", null);
      const { data: cached } = await q;
      const row = cached?.[0];
      if (row) {
        const age = Date.now() - new Date(row.generated_at as string).getTime();
        if (age < 24 * 3600_000) {
          return new Response(JSON.stringify({ insight: row, cached: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Fetch reviews
    let query = supabase
      .from("google_reviews")
      .select("review_id, stars, text, response_text, published_at, reviewer_name")
      .not("text", "is", null)
      .order("published_at", { ascending: false })
      .limit(300);
    if (storeId) query = query.eq("store_id", storeId);
    const interval = periodToInterval(period);
    if (interval) {
      const since = new Date(Date.now() - parseInt(interval) * 86400_000).toISOString();
      query = query.gte("published_at", since);
    }
    const { data: reviews, error: revErr } = await query;
    if (revErr) throw revErr;
    if (!reviews || reviews.length === 0) {
      return new Response(JSON.stringify({ error: "No reviews with text in this range" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build prompt — include up to ~150 reviews trimmed
    const sample = reviews.slice(0, 150);
    const reviewLines = sample
      .map((r) => `[id:${r.review_id}] ${r.stars}★ — ${(r.text ?? "").slice(0, 400).replace(/\s+/g, " ").trim()}`)
      .join("\n");

    const systemPrompt = `You analyse customer reviews of an Italian restaurant chain. Be concise, specific, and actionable. When citing examples, ALWAYS use the exact review_id from the input ([id:xxx]) so the operations team can find the source. Avoid generic phrases.`;

    const userPrompt = `Analyse the following ${sample.length} customer reviews${storeId ? " for a single store" : " across all stores"} from period "${period}". Identify top recurring positive themes, negative/concerning themes, and prioritised action items.

Reviews:
${reviewLines}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [ANALYZE_TOOL],
        tool_choice: { type: "function", function: { name: "report_review_insights" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      const status = aiResp.status;
      const message =
        status === 429 ? "AI rate limit reached. Please retry in a moment."
        : status === 402 ? "Lovable AI credits exhausted — add funds in Workspace settings."
        : `AI gateway error (${status}): ${errText.slice(0, 200)}`;
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI returned no structured insights");
    }
    const parsed = JSON.parse(toolCall.function.arguments);

    // Upsert into review_insights
    const upsertRow = {
      store_id: storeId,
      period,
      generated_at: new Date().toISOString(),
      model: "google/gemini-2.5-flash",
      summary: parsed.summary ?? null,
      themes_positive: parsed.themes_positive ?? [],
      themes_negative: parsed.themes_negative ?? [],
      action_items: parsed.action_items ?? [],
      sample_size: sample.length,
      raw: parsed,
    };

    // Manual upsert because of partial unique index for null store_id
    let existingId: string | null = null;
    {
      let q = supabase.from("review_insights").select("id").eq("period", period).limit(1);
      q = storeId ? q.eq("store_id", storeId) : q.is("store_id", null);
      const { data: existing } = await q;
      existingId = existing?.[0]?.id ?? null;
    }

    let saved;
    if (existingId) {
      const { data, error } = await supabase.from("review_insights").update(upsertRow).eq("id", existingId).select().single();
      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await supabase.from("review_insights").insert(upsertRow).select().single();
      if (error) throw error;
      saved = data;
    }

    await supabase.from("activity_log").insert({
      action: "reviews.insights_generated",
      entity_type: storeId ? "store" : "google_reviews",
      entity_id: storeId,
      details: { period, sample_size: sample.length },
    });

    return new Response(JSON.stringify({ insight: saved, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
