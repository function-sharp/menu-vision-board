import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Stars } from "@/components/StarDistribution";
import { useStoreReviewStats } from "@/hooks/useReviews";
import { useStores } from "@/hooks/useDashboardData";
import { useMemo } from "react";

export function StoreLeaderboard({ mode }: { mode: "top" | "bottom" }) {
  const { data: stats, isLoading } = useStoreReviewStats();
  const { data: stores } = useStores();

  const rows = useMemo(() => {
    if (!stats || !stores) return [];
    const storeMap = new Map(stores.map((s) => [s.id, s]));
    const enriched = stats
      .filter((s) => storeMap.has(s.store_id))
      .map((s) => ({ ...s, store: storeMap.get(s.store_id)! }));
    if (mode === "top") {
      return [...enriched].sort((a, b) => b.reviews - a.reviews).slice(0, 5);
    }
    // bottom: lowest rated, with ≥ 50 reviews to be meaningful
    return [...enriched].filter((s) => s.reviews >= 50).sort((a, b) => a.avg_stars - b.avg_stars).slice(0, 5);
  }, [stats, stores, mode]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{mode === "top" ? "Most reviewed stores" : "Lowest rated stores (≥50 reviews)"}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : rows.length === 0 ? (
          <div className="text-xs text-muted-foreground">No data.</div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.store_id} className="flex items-center justify-between gap-3">
                <Link to={`/stores/${r.store.slug}`} className="text-sm truncate hover:text-primary hover:underline min-w-0 flex-1">
                  {r.store.name}
                </Link>
                <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  <span className="tabular-nums">{r.reviews.toLocaleString()}</span>
                  <Stars value={r.avg_stars} size={11} />
                  <span className="tabular-nums w-8 text-right">{r.avg_stars.toFixed(2)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
