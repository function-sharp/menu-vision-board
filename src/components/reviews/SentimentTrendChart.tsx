import { useMemo } from "react";
import { useReviewStarTrend } from "@/hooks/useReviews";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

export function SentimentTrendChart({
  storeId,
  months = 12,
  title = "Sentiment over time",
  storeIds,
}: {
  storeId?: string | null;
  months?: number;
  title?: string;
  storeIds?: string[] | null;
}) {
  const { data, isLoading } = useReviewStarTrend(storeId ?? null, months, storeIds ?? null);

  const series = useMemo(() => {
    return (data ?? []).map((r) => {
      const negative = r.s1 + r.s2;
      const neutral = r.s3;
      const positive = r.s4 + r.s5;
      const total = negative + neutral + positive;
      return {
        label: r.label,
        month: r.month,
        positivePct: total ? +((positive / total) * 100).toFixed(1) : 0,
        neutralPct: total ? +((neutral / total) * 100).toFixed(1) : 0,
        negativePct: total ? +((negative / total) * 100).toFixed(1) : 0,
        total,
      };
    });
  }, [data]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48" />
        ) : (
          <div className="h-48 w-full">
            <ResponsiveContainer>
              <AreaChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    color: "hsl(var(--popover-foreground))",
                    fontSize: 12,
                  }}
                  formatter={(value: any, name: string) => [`${value}%`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="positivePct"
                  name="Positive (4–5★)"
                  stackId="sentiment"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.7}
                />
                <Area
                  type="monotone"
                  dataKey="neutralPct"
                  name="Neutral (3★)"
                  stackId="sentiment"
                  stroke="hsl(var(--muted-foreground))"
                  fill="hsl(var(--muted-foreground))"
                  fillOpacity={0.5}
                />
                <Area
                  type="monotone"
                  dataKey="negativePct"
                  name="Negative (1–2★)"
                  stackId="sentiment"
                  stroke="hsl(var(--destructive))"
                  fill="hsl(var(--destructive))"
                  fillOpacity={0.7}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
