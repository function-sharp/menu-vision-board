import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useReviewStats } from "@/hooks/useReviews";
import { Stars } from "@/components/StarDistribution";
import { ReviewTrendChart } from "./ReviewTrendChart";
import { ResponsePerformance } from "./ResponsePerformance";
import { StoreLeaderboard } from "./StoreLeaderboard";
import { MessageSquare, Star, ReplyAll, CalendarClock, Users, Clock } from "lucide-react";
import { useResponsePerformance, useStoreReviewStats } from "@/hooks/useReviews";

export function OverviewTab() {
  const { data: stats } = useReviewStats(null);
  const { data: respPerf } = useResponsePerformance(null);
  const { data: storeStats } = useStoreReviewStats();

  const aggregate = useMemo(() => {
    if (!storeStats) return null;
    const totalReplied = respPerf?.reduce((acc, r) => acc + r.replied, 0) ?? 0;
    const totalAll = respPerf?.reduce((acc, r) => acc + r.total, 0) ?? 0;
    const avgReplyDays = (() => {
      const arr = (storeStats ?? []).map((s) => s.avg_reply_days).filter((v): v is number => v != null);
      if (!arr.length) return null;
      return arr.reduce((a, b) => a + b, 0) / arr.length;
    })();
    return {
      totalReplied,
      totalAll,
      avgReplyDays,
    };
  }, [respPerf, storeStats]);

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi icon={<MessageSquare className="h-4 w-4" />} label="Total reviews" value={stats?.total.toLocaleString() ?? "—"} />
        <Kpi
          icon={<Star className="h-4 w-4" />}
          label="Average rating"
          value={stats ? stats.avgStars.toFixed(2) : "—"}
          extra={stats ? <Stars value={stats.avgStars} size={11} /> : null}
        />
        <Kpi icon={<ReplyAll className="h-4 w-4" />} label="Reply rate" value={stats ? `${Math.round(stats.responseRate * 100)}%` : "—"} />
        <Kpi
          icon={<Clock className="h-4 w-4" />}
          label="Avg reply time"
          value={aggregate?.avgReplyDays != null ? `${aggregate.avgReplyDays.toFixed(1)}d` : "—"}
        />
        <Kpi icon={<CalendarClock className="h-4 w-4" />} label="Last 30 days" value={stats?.last30.toLocaleString() ?? "—"} />
        <Kpi icon={<Users className="h-4 w-4" />} label="Linked stores" value={(storeStats?.length ?? 0).toLocaleString()} />
      </div>

      <ReviewTrendChart storeId={null} months={24} title="Review volume & rating — last 24 months" />

      <div className="grid lg:grid-cols-2 gap-4">
        <ResponsePerformance storeId={null} />
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="text-sm font-medium">Detailed averages</div>
            {stats ? (
              <div className="grid grid-cols-3 gap-3 text-center">
                <Stat label="Food" value={stats.avgFood} />
                <Stat label="Service" value={stats.avgService} />
                <Stat label="Atmosphere" value={stats.avgAtmosphere} />
              </div>
            ) : (
              <Skeleton className="h-20" />
            )}
            <div className="text-xs text-muted-foreground pt-2 border-t">
              Sub-ratings are submitted by Local Guides on Google Maps. Coverage varies by store.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <StoreLeaderboard mode="top" />
        <StoreLeaderboard mode="bottom" />
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, extra }: { icon: React.ReactNode; label: string; value: string; extra?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground text-[10px] uppercase tracking-wide">
          <span>{label}</span>
          {icon}
        </div>
        <div className="text-xl font-bold mt-1.5">{value}</div>
        {extra && <div className="mt-1">{extra}</div>}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-1">{value ? value.toFixed(2) : "—"}</div>
      <div className="mt-1 flex justify-center"><Stars value={value} size={11} /></div>
    </div>
  );
}
