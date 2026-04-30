import { useReviewTrend } from "@/hooks/useReviews";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
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
                    if (name === "Reply rate") return [`${Math.round((Number(value) || 0) * 100)}%`, name];
                    if (name === "Avg rating") return [Number(value).toFixed(2), name];
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="count" name="Reviews" fill="hsl(var(--primary))" opacity={0.6} radius={[3, 3, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="avg" name="Avg rating" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="replyRatePlot" name="Reply rate" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="count" name="Reviews" fill="hsl(var(--primary))" opacity={0.6} radius={[3, 3, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="avg" name="Avg rating" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
