/**
 * Canonical review KPI calculations shared between the single-store
 * (StoreDetail) and multi-store comparison PDF exports.
 *
 * Both surfaces must report the same metric using the same math and the same
 * label, so that a row labelled "Reply rate" or "Average rating" means
 * exactly the same thing regardless of which export produced it.
 */
import {
  fmtDecimal,
  fmtInt,
  fmtPctFromFraction,
  fmtRating,
} from "@/lib/pdfReport";

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
