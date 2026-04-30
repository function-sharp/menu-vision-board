import { useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchStoreTrend, trendToStoreKpi, buildComparisonKpiRows } from "@/lib/reviewKpis";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { X, Download } from "lucide-react";

const RANGES: Array<{ key: string; label: string; months: number }> = [
  { key: "3m", label: "3M", months: 3 },
  { key: "6m", label: "6M", months: 6 },
  { key: "12m", label: "12M", months: 12 },
  { key: "24m", label: "24M", months: 24 },
];

// Distinct line colors for up to 5 stores (use semantic primary + chart palette tokens)
const STORE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(var(--chart-3, 142 71% 45%))",
  "hsl(var(--chart-4, 38 92% 50%))",
  "hsl(var(--chart-5, 262 83% 58%))",
];

type StoreInfo = { id: string; name: string };

// fetchStoreTrend lives in @/lib/reviewKpis so single-store and comparison
// exports compute KPIs from the same data source with identical math.


export function ComparisonPanel({
  selectedStores,
  range,
  onRangeChange,
  onRemove,
  onClear,
}: {
  selectedStores: StoreInfo[];
  range: string;
  onRangeChange: (key: string) => void;
  onRemove: (storeId: string) => void;
  onClear: () => void;
}) {
  const months = (RANGES.find((r) => r.key === range) ?? RANGES[3]).months;

  const queries = useQueries({
    queries: selectedStores.map((s) => ({
      queryKey: ["store-comparison-trend", s.id, months],
      queryFn: () => fetchStoreTrend(s.id, months),
      staleTime: 60_000,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const allReady = queries.every((q) => q.data);

  // Merge series across stores into a single dataset keyed by month label
  const mergedVolume = useMemo(() => {
    if (!allReady) return [];
    const labels = queries[0]!.data!.series.map((p) => p.label);
    return labels.map((label, idx) => {
      const row: any = { label };
      selectedStores.forEach((s, i) => {
        row[s.id] = queries[i].data!.series[idx]?.count ?? 0;
      });
      return row;
    });
  }, [allReady, queries, selectedStores]);

  const mergedRating = useMemo(() => {
    if (!allReady) return [];
    const labels = queries[0]!.data!.series.map((p) => p.label);
    return labels.map((label, idx) => {
      const row: any = { label };
      selectedStores.forEach((s, i) => {
        const v = queries[i].data!.series[idx]?.avg ?? 0;
        row[s.id] = v || null; // null skips line gap when no reviews
      });
      return row;
    });
  }, [allReady, queries, selectedStores]);

  const mergedSentiment = useMemo(() => {
    if (!allReady) return [];
    const labels = queries[0]!.data!.series.map((p) => p.label);
    return labels.map((label, idx) => {
      const row: any = { label };
      selectedStores.forEach((s, i) => {
        const point = queries[i].data!.series[idx];
        row[s.id] = point && point.count > 0 ? point.positivePct : null;
      });
      return row;
    });
  }, [allReady, queries, selectedStores]);

  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const rangeLabel = (RANGES.find((r) => r.key === range) ?? RANGES[3]).label;

  const handleExportPdf = async () => {
    if (!reportRef.current) return;
    if (!allReady) {
      toast.info("Wait for data to finish loading");
      return;
    }
    try {
      setExporting(true);
      const { exportStoreReportPdf, fmtInt, fmtRating, fmtPctFromFraction, fmtDecimal } = await import("@/lib/pdfReport");
      const months = (RANGES.find((r) => r.key === range) ?? RANGES[3]).months;
      const totalReviews = queries.reduce((acc, q) => acc + (q.data?.kpi.totalReviews ?? 0), 0);
      const ratedAvg = queries.reduce(
        (acc, q) => {
          const k = q.data?.kpi;
          if (!k || !k.totalReviews) return acc;
          return { sum: acc.sum + k.avgRating * k.totalReviews, n: acc.n + k.totalReviews };
        },
        { sum: 0, n: 0 },
      );
      const avgAcross = ratedAvg.n ? ratedAvg.sum / ratedAvg.n : 0;
      const last30 = queries.reduce((acc, q) => acc + (q.data?.kpi.last30 ?? 0), 0);
      const replyRates = queries
        .map((q) => q.data?.kpi.replyRate)
        .filter((v): v is number => typeof v === "number");
      const avgReplyRate = replyRates.length ? replyRates.reduce((a, b) => a + b, 0) / replyRates.length : 0;

      // Top performers
      let topVolume = { name: "—", value: 0 };
      let topRating = { name: "—", value: 0 };
      selectedStores.forEach((s, i) => {
        const k = queries[i].data?.kpi;
        if (!k) return;
        if (k.totalReviews > topVolume.value) topVolume = { name: s.name, value: k.totalReviews };
        if (k.avgRating > topRating.value) topRating = { name: s.name, value: k.avgRating };
      });

      await exportStoreReportPdf(reportRef.current, {
        storeName: `Store comparison (${selectedStores.length})`,
        storeGroup: selectedStores.map((s) => s.name).join(" · "),
        rangeLabel: `Last ${months} months`,
        rangeMonths: months,
        kpis: [
          { label: "Stores compared", value: fmtInt(selectedStores.length) },
          { label: "Total reviews (across stores)", value: fmtInt(totalReviews) },
          { label: "Weighted average rating", value: fmtRating(avgAcross) },
          { label: "Average reply rate", value: fmtPctFromFraction(avgReplyRate, 1) },
          { label: "Reviews in last 30 days", value: fmtInt(last30) },
          { label: "Top store by volume", value: `${topVolume.name} — ${fmtInt(topVolume.value)}` },
          { label: "Top store by rating", value: `${topRating.name} — ${fmtDecimal(topRating.value, 2)}` },
        ],
      });
      toast.success("Comparison PDF downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    } finally {
      setExporting(false);
    }
  };

  if (selectedStores.length === 0) return null;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Compare {selectedStores.length} store{selectedStores.length === 1 ? "" : "s"}</CardTitle>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {selectedStores.map((s, i) => (
              <Badge key={s.id} variant="secondary" className="gap-1.5 pl-2 pr-1 py-0.5 text-xs">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: STORE_COLORS[i % STORE_COLORS.length] }}
                />
                {s.name}
                <button
                  type="button"
                  onClick={() => onRemove(s.id)}
                  className="ml-0.5 rounded hover:bg-muted p-0.5"
                  aria-label={`Remove ${s.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {RANGES.map((r) => (
              <Button
                key={r.key}
                variant={range === r.key ? "default" : "outline"}
                size="sm"
                onClick={() => onRangeChange(r.key)}
                className="h-7 px-2.5 text-xs"
              >
                {r.label}
              </Button>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClear}>
            Clear all
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={handleExportPdf}
            disabled={exporting || !allReady}
          >
            <Download className="h-3 w-3 mr-1" />
            {exporting ? "Generating..." : "Export PDF"}
          </Button>
        </div>
      </CardHeader>

      <CardContent ref={reportRef} className="space-y-5">
        {/* KPI table */}
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store</TableHead>
                <TableHead className="text-right">Total reviews</TableHead>
                <TableHead className="text-right">Avg rating</TableHead>
                <TableHead className="text-right">Reply rate</TableHead>
                <TableHead className="text-right">Last 30d</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedStores.map((s, i) => {
                const k = queries[i].data?.kpi;
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ background: STORE_COLORS[i % STORE_COLORS.length] }}
                        />
                        <span className="font-medium">{s.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{k ? k.totalReviews.toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{k ? k.avgRating.toFixed(2) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{k ? `${Math.round(k.replyRate * 100)}%` : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{k ? k.last30.toLocaleString() : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Trend charts */}
        <div className="grid lg:grid-cols-2 gap-4">
          <ChartCard title="Review volume" loading={isLoading}>
            <LineChart data={mergedVolume}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <CommonTooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => storeNameById(v, selectedStores)} />
              {selectedStores.map((s, i) => (
                <Line key={s.id} type="monotone" dataKey={s.id} name={s.id} stroke={STORE_COLORS[i % STORE_COLORS.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ChartCard>

          <ChartCard title="Average rating" loading={isLoading}>
            <LineChart data={mergedRating}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis domain={[0, 5]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <CommonTooltip valueFormatter={(v) => Number(v).toFixed(2)} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => storeNameById(v, selectedStores)} />
              {selectedStores.map((s, i) => (
                <Line key={s.id} type="monotone" dataKey={s.id} name={s.id} stroke={STORE_COLORS[i % STORE_COLORS.length]} strokeWidth={2} dot={false} connectNulls />
              ))}
            </LineChart>
          </ChartCard>

          <ChartCard title="Positive sentiment % (4–5★)" loading={isLoading} className="lg:col-span-2">
            <LineChart data={mergedSentiment}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <CommonTooltip valueFormatter={(v) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => storeNameById(v, selectedStores)} />
              {selectedStores.map((s, i) => (
                <Line key={s.id} type="monotone" dataKey={s.id} name={s.id} stroke={STORE_COLORS[i % STORE_COLORS.length]} strokeWidth={2} dot={false} connectNulls />
              ))}
            </LineChart>
          </ChartCard>
        </div>
      </CardContent>
    </Card>
  );
}

function storeNameById(id: string, stores: StoreInfo[]): string {
  return stores.find((s) => s.id === id)?.name ?? id;
}

function ChartCard({ title, loading, children, className }: { title: string; loading: boolean; children: React.ReactElement; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-56" />
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer>{children}</ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CommonTooltip({ valueFormatter }: { valueFormatter?: (v: any) => string }) {
  return (
    <Tooltip
      contentStyle={{
        background: "hsl(var(--popover))",
        border: "1px solid hsl(var(--border))",
        borderRadius: 8,
        color: "hsl(var(--popover-foreground))",
        fontSize: 12,
      }}
      formatter={(value: any) => (valueFormatter ? valueFormatter(value) : value)}
    />
  );
}
