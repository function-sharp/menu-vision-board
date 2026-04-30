import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useStores, useAllItems } from "@/hooks/useDashboardData";
import { useReviewStats, useReviewTrend } from "@/hooks/useReviews";
import { Stars } from "@/components/StarDistribution";
import { formatZAR } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ComposedChart, Line } from "recharts";
import { Star, Store as StoreIcon, Utensils, TrendingUp, Layers, MessageSquare, ReplyAll, ArrowRight } from "lucide-react";

export default function Overview() {
  const { data: stores, isLoading: sl } = useStores();
  const { data: items, isLoading: il } = useAllItems();

  const stats = useMemo(() => {
    if (!stores || !items) return null;
    const prices = items.filter((i) => i.price != null).map((i) => Number(i.price));
    const avgPrice = prices.reduce((a, b) => a + b, 0) / (prices.length || 1);
    const groups: Record<string, number> = {};
    stores.forEach((s) => { groups[s.store_group || "—"] = (groups[s.store_group || "—"] || 0) + 1; });
    return {
      totalStores: stores.length,
      totalItems: items.length,
      avgItems: Math.round(items.length / stores.length),
      avgPrice,
      groups,
    };
  }, [stores, items]);

  const itemsPerStore = useMemo(() => {
    if (!stores) return [];
    return [...stores]
      .map((s) => ({ name: s.name.replace("Col'Cacchio ", "").replace("GO ", ""), count: s.item_count, slug: s.slug }))
      .sort((a, b) => b.count - a.count);
  }, [stores]);

  const topCategories = useMemo(() => {
    if (!items) return [];
    const map: Record<string, number> = {};
    items.forEach((i) => { if (i.category) map[i.category] = (map[i.category] || 0) + 1; });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [items]);

  const priceBuckets = useMemo(() => {
    if (!items) return [];
    const buckets = [
      { range: "<R50", min: 0, max: 50, count: 0 },
      { range: "R50–100", min: 50, max: 100, count: 0 },
      { range: "R100–150", min: 100, max: 150, count: 0 },
      { range: "R150–200", min: 150, max: 200, count: 0 },
      { range: "R200–300", min: 200, max: 300, count: 0 },
      { range: "R300–400", min: 300, max: 400, count: 0 },
      { range: "R400+", min: 400, max: Infinity, count: 0 },
    ];
    items.forEach((i) => {
      const p = Number(i.price);
      if (!p) return;
      const b = buckets.find((x) => p >= x.min && p < x.max);
      if (b) b.count++;
    });
    return buckets;
  }, [items]);

  if (sl || il || !stats) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground text-sm">High-level view of all stores and menu items.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={StoreIcon} label="Total stores" value={stats.totalStores.toString()} />
        <KpiCard icon={Utensils} label="Total menu items" value={stats.totalItems.toLocaleString()} />
        <KpiCard icon={Layers} label="Avg items / store" value={stats.avgItems.toString()} />
        <KpiCard icon={TrendingUp} label="Avg price" value={formatZAR(stats.avgPrice)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Items per store</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={420}>
              <BarChart data={itemsPerStore} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" className="text-xs" />
                <YAxis dataKey="name" type="category" width={140} className="text-xs" />
                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {itemsPerStore.map((_, i) => <Cell key={i} fill="hsl(var(--primary))" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 10 categories</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topCategories} margin={{ bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" angle={-30} textAnchor="end" interval={0} height={70} />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Price distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={priceBuckets}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="range" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary-glow))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stores by rating</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...stores!].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 9).map((s) => (
              <Link to={`/stores/${s.slug}`} key={s.id} className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.item_count} items · {s.store_group}</div>
                </div>
                <Badge variant="secondary" className="gap-1 shrink-0"><Star className="h-3 w-3 fill-current" />{s.rating?.toFixed(1) ?? "—"}</Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="h-96" />
    </div>
  );
}
