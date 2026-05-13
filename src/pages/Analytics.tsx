import { useMemo } from "react";
import { useAllItems, useStores } from "@/hooks/useDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatZAR, decodeText } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function Analytics() {
  usePageMeta({ title: "Categories & Pricing · Col'Cacchio", description: "Pricing and category analytics across the Col'Cacchio store network." });
  const { data: items, isLoading: il } = useAllItems();
  const { data: stores, isLoading: sl } = useStores();

  const categoryStats = useMemo(() => {
    if (!items) return [];
    const map: Record<string, number[]> = {};
    items.forEach((i) => {
      if (i.category && i.price != null) {
        if (!map[i.category]) map[i.category] = [];
        map[i.category].push(Number(i.price));
      }
    });
    return Object.entries(map).map(([category, prices]) => ({
      category: decodeText(category).slice(0, 20),
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      min: Math.min(...prices),
      max: Math.max(...prices),
      count: prices.length,
    })).sort((a, b) => b.count - a.count).slice(0, 12);
  }, [items]);

  const storeAvg = useMemo(() => {
    if (!items || !stores) return [];
    const map: Record<string, number[]> = {};
    items.forEach((i) => {
      if (i.price != null) {
        const sn = i.stores.name;
        if (!map[sn]) map[sn] = [];
        map[sn].push(Number(i.price));
      }
    });
    return Object.entries(map).map(([store, prices]) => {
      const s = stores.find((x) => x.name === store);
      return {
        store: store.replace("Col'Cacchio ", "").replace("GO ", ""),
        avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
        group: s?.store_group ?? "—",
      };
    }).sort((a, b) => b.avg - a.avg);
  }, [items, stores]);

  const groupComparison = useMemo(() => {
    if (!items) return [];
    const map: Record<string, number[]> = {};
    items.forEach((i) => {
      if (i.price != null && i.stores.store_group) {
        if (!map[i.stores.store_group]) map[i.stores.store_group] = [];
        map[i.stores.store_group].push(Number(i.price));
      }
    });
    return Object.entries(map).map(([group, prices]) => {
      const sorted = [...prices].sort((a, b) => a - b);
      return {
        group, items: prices.length,
        avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
        median: sorted[Math.floor(sorted.length / 2)],
        min: sorted[0], max: sorted[sorted.length - 1],
      };
    });
  }, [items]);

  const matrix = useMemo(() => {
    if (!items || !stores) return { topCats: [] as string[], rows: [] as Array<{ store: string; counts: number[] }> };
    const catCounts: Record<string, number> = {};
    items.forEach((i) => { if (i.category) catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
    const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c]) => c);
    const rows = stores.map((s) => {
      const counts = topCats.map((c) => items.filter((i) => i.stores.slug === s.slug && i.category === c).length);
      return { store: s.name.replace("Col'Cacchio ", "").replace("GO ", ""), counts };
    });
    return { topCats, rows };
  }, [items, stores]);

  if (il || sl) return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Categories & Pricing</h1>
        <p className="text-muted-foreground text-sm">Pricing patterns across categories, stores, and groups.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Avg / min / max price by top categories</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={categoryStats} margin={{ bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="category" className="text-xs" angle={-30} textAnchor="end" interval={0} height={80} />
              <YAxis className="text-xs" tickFormatter={(v) => `R${v}`} />
              <Tooltip formatter={(v: any) => formatZAR(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="min" fill="hsl(var(--accent))" name="Min" />
              <Bar dataKey="avg" fill="hsl(var(--primary))" name="Avg" />
              <Bar dataKey="max" fill="hsl(var(--primary-glow))" name="Max" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Avg price by store</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={500}>
              <BarChart data={storeAvg} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" className="text-xs" tickFormatter={(v) => `R${v}`} />
                <YAxis dataKey="store" type="category" width={140} className="text-xs" />
                <Tooltip formatter={(v: any) => formatZAR(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Group comparison</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {groupComparison.map((g) => (
                <div key={g.group} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold">{g.group}</div>
                    <div className="text-xs text-muted-foreground">{g.items.toLocaleString()} items</div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-sm">
                    <div><div className="text-xs text-muted-foreground">Min</div><div className="font-semibold">{formatZAR(g.min)}</div></div>
                    <div><div className="text-xs text-muted-foreground">Median</div><div className="font-semibold">{formatZAR(g.median)}</div></div>
                    <div><div className="text-xs text-muted-foreground">Avg</div><div className="font-semibold text-primary">{formatZAR(g.avg)}</div></div>
                    <div><div className="text-xs text-muted-foreground">Max</div><div className="font-semibold">{formatZAR(g.max)}</div></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Category presence (items per store × top category)</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left font-medium sticky left-0 bg-muted/50">Store</th>
                {matrix.topCats.map((c) => (
                  <th key={c} className="p-2 text-center font-medium text-xs whitespace-nowrap">{decodeText(c).slice(0, 20)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((r) => (
                <tr key={r.store} className="border-b">
                  <td className="p-2 font-medium sticky left-0 bg-card whitespace-nowrap">{r.store}</td>
                  {r.counts.map((c, idx) => {
                    const intensity = Math.min(c / 15, 1);
                    return (
                      <td key={idx} className="p-2 text-center" style={{ background: c > 0 ? `hsl(var(--primary) / ${intensity * 0.45})` : undefined }}>
                        {c || "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
