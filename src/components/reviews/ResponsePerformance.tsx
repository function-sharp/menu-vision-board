import { useResponsePerformance } from "@/hooks/useReviews";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Star } from "lucide-react";

export function ResponsePerformance({ storeId, storeIds }: { storeId?: string | null; storeIds?: string[] | null }) {
  const { data, isLoading } = useResponsePerformance(storeId ?? null, storeIds ?? null);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Response performance by rating</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="space-y-2">
            {data.map((row) => (
              <div key={row.star} className="grid grid-cols-12 items-center gap-2 text-xs">
                <div className="col-span-2 flex items-center gap-1">
                  <span className="tabular-nums">{row.star}</span>
                  <Star className="h-3 w-3 fill-primary text-primary" />
                </div>
                <div className="col-span-5 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${Math.round(row.responseRate * 100)}%` }} />
                </div>
                <div className="col-span-2 text-right tabular-nums text-muted-foreground">
                  {Math.round(row.responseRate * 100)}%
                </div>
                <div className="col-span-3 text-right tabular-nums text-muted-foreground">
                  {row.medianReplyDays != null ? `${row.medianReplyDays.toFixed(1)}d median` : "—"}
                </div>
              </div>
            ))}
            <div className="pt-2 mt-2 border-t text-[11px] text-muted-foreground flex justify-between">
              <span>% replied</span>
              <span>Median time-to-reply</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
