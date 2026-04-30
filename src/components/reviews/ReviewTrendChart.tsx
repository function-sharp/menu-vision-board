import { Link } from "react-router-dom";
import { useReviewTrend, useReviewStarTrend } from "@/hooks/useReviews";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Download } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

export function ReviewTrendChart({ storeId, months = 24, title = "Review trend", storeIds }: { storeId?: string | null; months?: number; title?: string; storeIds?: string[] | null }) {
  const { data, isLoading } = useReviewTrend(storeId ?? null, months, storeIds ?? null);
  const { data: starData } = useReviewStarTrend(storeId ?? null, months, storeIds ?? null);

  // Build deep link to Reviews hub with the same store + date range applied
  const since = (() => {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCMonth(d.getUTCMonth() - (months - 1));
    return d.toISOString();
  })();
  const drilldownParams = new URLSearchParams();
  drilldownParams.set("tab", "list");
  drilldownParams.set("since", since);
  if (storeId) drilldownParams.set("store", storeId);
  const drilldownHref = `/reviews?${drilldownParams.toString()}`;

  const handleExport = () => {
    if (!data || !data.length) {
      toast.info("No trend data to export");
      return;
    }
    const starByMonth = new Map<string, { s1: number; s2: number; s3: number; s4: number; s5: number }>();
    (starData ?? []).forEach((r) => starByMonth.set(r.month, { s1: r.s1, s2: r.s2, s3: r.s3, s4: r.s4, s5: r.s5 }));

    const headers = [
      "month", "label",
      "review_count", "avg_rating", "reply_rate_pct",
      "1_star", "2_star", "3_star", "4_star", "5_star",
    ];
    const lines = [headers.join(",")];
    for (const r of data) {
      const s = starByMonth.get(r.month) ?? { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 };
      lines.push(
        [
          r.month, r.label,
          r.count, r.avg, Math.round(r.responseRate * 100),
          s.s1, s.s2, s.s3, s.s4, s.s5,
        ].map(csvEscape).join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const scope = storeId ? `store-${storeId.slice(0, 8)}` : "all";
    a.href = url;
    a.download = `review-trends-${scope}-${months}m-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Trend report downloaded");
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm">{title}</CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleExport}>
            <Download className="h-3 w-3 mr-1" />
            Export trends
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
            <Link to={drilldownHref}>
              Open in Reviews hub
              <ExternalLink className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 5]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    color: "hsl(var(--popover-foreground))",
                    fontSize: 12,
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === "Reply rate") return [`${Math.round(((Number(value) || 0) / 5) * 100)}%`, name];
                    if (name === "Avg rating") return [Number(value).toFixed(2), name];
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="count" name="Reviews" fill="hsl(var(--primary))" opacity={0.6} radius={[3, 3, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="avg" name="Avg rating" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="replyRatePlot" name="Reply rate" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
