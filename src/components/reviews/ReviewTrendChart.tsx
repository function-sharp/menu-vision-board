import { Link } from "react-router-dom";
import { useReviewTrend } from "@/hooks/useReviews";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink } from "lucide-react";
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

export function ReviewTrendChart({ storeId, months = 24, title = "Review trend", storeIds }: { storeId?: string | null; months?: number; title?: string; storeIds?: string[] | null }) {
  const { data, isLoading } = useReviewTrend(storeId ?? null, months, storeIds ?? null);

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

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm">{title}</CardTitle>
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Link to={drilldownHref}>
            Open in Reviews hub
            <ExternalLink className="h-3 w-3 ml-1" />
          </Link>
        </Button>
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
