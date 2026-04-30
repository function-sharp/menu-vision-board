import { useReviewStarTrend } from "@/hooks/useReviews";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

// Color ramp: 1★ destructive → 5★ primary
const STAR_COLORS: Record<string, string> = {
  s1: "hsl(var(--destructive))",
  s2: "hsl(var(--destructive) / 0.6)",
  s3: "hsl(var(--muted-foreground))",
  s4: "hsl(var(--primary) / 0.6)",
  s5: "hsl(var(--primary))",
};

const STAR_LABELS: Record<string, string> = {
  s1: "1★",
  s2: "2★",
  s3: "3★",
  s4: "4★",
  s5: "5★",
};

export function StarDistributionTrendChart({
  storeId,
  months = 12,
  title = "Rating distribution over time",
  storeIds,
}: {
  storeId?: string | null;
  months?: number;
  title?: string;
  storeIds?: string[] | null;
}) {
  const { data, isLoading } = useReviewStarTrend(storeId ?? null, months, storeIds ?? null);

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
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    color: "hsl(var(--popover-foreground))",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {(["s1", "s2", "s3", "s4", "s5"] as const).map((k) => (
                  <Bar
                    key={k}
                    dataKey={k}
                    name={STAR_LABELS[k]}
                    stackId="stars"
                    fill={STAR_COLORS[k]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
