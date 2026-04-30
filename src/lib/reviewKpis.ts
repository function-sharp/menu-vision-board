/**
 * Canonical review KPI calculations shared between the single-store
 * (StoreDetail) and multi-store comparison PDF exports.
 *
 * Both surfaces must report the same metric using the same math and the same
 * label, so that a row labelled "Reply rate" or "Average rating" means
 * exactly the same thing regardless of which export produced it.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  fmtDecimal,
  fmtInt,
  fmtPctFromFraction,
  fmtRating,
} from "@/lib/pdfReport";

/* ------------------------------------------------------------------ */
/* Canonical range-scoped fetch (one source of truth for both exports) */
/* ------------------------------------------------------------------ */

export interface StoreTrendPoint {
  month: string;
  label: string;
  count: number;
  avg: number;
  positivePct: number;
}

export interface StoreTrendResult {
  series: StoreTrendPoint[];
  kpi: { totalReviews: number; avgRating: number; replyRate: number; last30: number };
}

/** Fetch monthly buckets + range-scoped KPI rollup for a single store. */
export async function fetchStoreTrend(storeId: string, months: number): Promise<StoreTrendResult> {
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  const all: Array<{ stars: number | null; published_at: string | null; response_text: string | null }> = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("google_reviews")
      .select("stars,published_at,response_text")
      .eq("store_id", storeId)
      .gte("published_at", since.toISOString())
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as any));
    if (data.length < pageSize) break;
  }
  const buckets = new Map<string, { count: number; sum: number; n: number; replied: number; pos: number; neu: number; neg: number }>();
  for (const r of all) {
    if (!r.published_at) continue;
    const d = new Date(r.published_at);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const b = buckets.get(key) ?? { count: 0, sum: 0, n: 0, replied: 0, pos: 0, neu: 0, neg: 0 };
    b.count++;
    if (r.stars != null) {
      b.sum += r.stars;
      b.n++;
      if (r.stars >= 4) b.pos++;
      else if (r.stars === 3) b.neu++;
      else b.neg++;
    }
    if (r.response_text) b.replied++;
    buckets.set(key, b);
  }
  const series: StoreTrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const b = buckets.get(key);
    const ratedTotal = b ? b.pos + b.neu + b.neg : 0;
    series.push({
      month: key,
      label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
      count: b?.count ?? 0,
      avg: b?.n ? +(b.sum / b.n).toFixed(2) : 0,
      positivePct: ratedTotal ? +((b!.pos / ratedTotal) * 100).toFixed(1) : 0,
    });
  }
  const totalReviews = all.length;
  const ratedAll = all.filter((r) => r.stars != null);
  const avgRating = ratedAll.length ? ratedAll.reduce((a, r) => a + (r.stars as number), 0) / ratedAll.length : 0;
  const replied = all.filter((r) => r.response_text).length;
  const replyRate = totalReviews ? replied / totalReviews : 0;
  const last30Cutoff = Date.now() - 30 * 86400_000;
  const last30 = all.filter((r) => r.published_at && new Date(r.published_at).getTime() >= last30Cutoff).length;
  return { series, kpi: { totalReviews, avgRating, replyRate, last30 } };
}

/** Convert a fetched trend result into the canonical StoreKpi for a store. */
export function trendToStoreKpi(storeId: string, storeName: string, t: StoreTrendResult): StoreKpi {
  return {
    storeId,
    storeName,
    totalReviews: t.kpi.totalReviews,
    avgRating: t.kpi.avgRating,
    replyRate: t.kpi.replyRate,
    last30: t.kpi.last30,
    monthlyCounts: t.series.map((p) => p.count),
  };
}

/** Per-store rollup, range-scoped (i.e. limited to the selected timeframe). */
export interface StoreKpi {
  storeId: string;
  storeName: string;
  totalReviews: number;
  avgRating: number; // 0-5
  replyRate: number; // 0-1
  last30: number;
  /** Optional monthly counts within range, used to derive avg/month. */
  monthlyCounts?: number[];
}

/** Optional all-time facts for the single-store report. */
export interface AllTimeFacts {
  total: number;
  avgStars: number;
  responseRate: number; // 0-1
  /** [1★, 2★, 3★, 4★, 5★] */
  distribution: number[];
}

/** A label/value row destined for the PDF KPI summary table. */
export type KpiRow = { label: string; value: string };

/* ------------------------------------------------------------------ */
/* Aggregations                                                        */
/* ------------------------------------------------------------------ */

/** Weighted average rating across stores, weighted by each store's volume. */
export function weightedAvgRating(stores: StoreKpi[]): number {
  let sum = 0;
  let n = 0;
  for (const s of stores) {
    if (!s.totalReviews) continue;
    sum += s.avgRating * s.totalReviews;
    n += s.totalReviews;
  }
  return n ? sum / n : 0;
}

/** Volume-weighted reply rate across stores (consistent with weightedAvgRating). */
export function weightedReplyRate(stores: StoreKpi[]): number {
  let replied = 0;
  let total = 0;
  for (const s of stores) {
    if (!s.totalReviews) continue;
    replied += s.replyRate * s.totalReviews;
    total += s.totalReviews;
  }
  return total ? replied / total : 0;
}

export function sumTotalReviews(stores: StoreKpi[]): number {
  return stores.reduce((a, s) => a + (s.totalReviews ?? 0), 0);
}

export function sumLast30(stores: StoreKpi[]): number {
  return stores.reduce((a, s) => a + (s.last30 ?? 0), 0);
}

export function avgMonthlyFromCounts(counts: number[] | undefined): number {
  if (!counts || counts.length === 0) return 0;
  return counts.reduce((a, b) => a + b, 0) / counts.length;
}

/* ------------------------------------------------------------------ */
/* Row builders — shared label vocabulary for both exports             */
/* ------------------------------------------------------------------ */

/** Build the canonical KPI rows for a single-store report. */
export function buildSingleStoreKpiRows(args: {
  rangeMonths: number;
  rangeStore: StoreKpi;
  allTime?: AllTimeFacts;
}): KpiRow[] {
  const { rangeMonths, rangeStore, allTime } = args;
  const rangeTotal = rangeStore.totalReviews;
  const avgMonthly = avgMonthlyFromCounts(rangeStore.monthlyCounts) ||
    (rangeMonths ? rangeTotal / rangeMonths : 0);

  const rows: KpiRow[] = [
    { label: "Total reviews (selected range)", value: fmtInt(rangeTotal) },
    { label: "Average rating (selected range)", value: fmtRating(rangeStore.avgRating) },
    { label: "Reply rate (selected range)", value: fmtPctFromFraction(rangeStore.replyRate, 1) },
    { label: "Reviews in last 30 days", value: fmtInt(rangeStore.last30) },
    { label: "Average reviews per month", value: fmtDecimal(avgMonthly, 1) },
  ];

  if (allTime) {
    rows.push(
      { label: "Total reviews (all time)", value: fmtInt(allTime.total) },
      { label: "Average rating (all time)", value: fmtRating(allTime.avgStars) },
      { label: "Reply rate (all time)", value: fmtPctFromFraction(allTime.responseRate, 1) },
      { label: "5★ reviews (all time)", value: fmtInt(allTime.distribution[4] ?? 0) },
      { label: "1★ reviews (all time)", value: fmtInt(allTime.distribution[0] ?? 0) },
    );
  }

  return rows;
}

/** Build the canonical KPI rows for a multi-store comparison report. */
export function buildComparisonKpiRows(args: {
  rangeMonths: number;
  stores: StoreKpi[];
}): KpiRow[] {
  const { stores } = args;
  const totalReviews = sumTotalReviews(stores);
  const avgRating = weightedAvgRating(stores);
  const replyRate = weightedReplyRate(stores);
  const last30 = sumLast30(stores);

  // Top performers — only consider stores with data
  let topVolume = { name: "—", value: 0 };
  let topRating = { name: "—", value: 0 };
  for (const s of stores) {
    if (!s.totalReviews) continue;
    if (s.totalReviews > topVolume.value) topVolume = { name: s.storeName, value: s.totalReviews };
    if (s.avgRating > topRating.value) topRating = { name: s.storeName, value: s.avgRating };
  }

  return [
    { label: "Stores compared", value: fmtInt(stores.length) },
    { label: "Total reviews (selected range)", value: fmtInt(totalReviews) },
    { label: "Average rating (selected range)", value: fmtRating(avgRating) },
    { label: "Reply rate (selected range)", value: fmtPctFromFraction(replyRate, 1) },
    { label: "Reviews in last 30 days", value: fmtInt(last30) },
    { label: "Top store by volume", value: `${topVolume.name} — ${fmtInt(topVolume.value)}` },
    { label: "Top store by rating", value: `${topRating.name} — ${fmtDecimal(topRating.value, 2)}` },
  ];
}
