import { useMemo, useState } from "react";
import { useAllItems } from "@/hooks/useDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatZAR, decodeText } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Search, TrendingDown, TrendingUp } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function ItemComparison() {
  usePageMeta({ title: "Item Comparison · Col'Cacchio", description: "Compare the same Col'Cacchio menu item across multiple stores side by side." });
  const { data: items, isLoading } = useAllItems();
  const [q, setQ] = useState("Margherita");

  const matches = useMemo(() => {
    if (!items || !q.trim()) return [];
    const ql = q.toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(ql));
  }, [items, q]);

  const suggestions = useMemo(() => {
    if (!items) return [];
    const map: Record<string, number> = {};
    items.forEach((i) => {
      const key = decodeText(i.name);
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).filter(([, c]) => c >= 5).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([n]) => n);
  }, [items]);

  const chartData = useMemo(() => {
    return matches
      .filter((m) => m.price != null)
      .map((m) => ({ store: m.stores.name.replace("Col'Cacchio ", "").replace("GO ", ""), price: Number(m.price) }))
      .sort((a, b) => a.price - b.price);
  }, [matches]);

  const stats = useMemo(() => {
    const prices = matches.filter((m) => m.price != null).map((m) => Number(m.price));
    if (prices.length === 0) return null;
    const min = Math.min(...prices), max = Math.max(...prices);
    return {
      min, max, avg: prices.reduce((a, b) => a + b, 0) / prices.length, count: matches.length, spread: max - min,
      cheapestStore: matches.filter((m) => m.price != null).sort((a, b) => Number(a.price) - Number(b.price))[0],
      priciestStore: matches.filter((m) => m.price != null).sort((a, b) => Number(b.price) - Number(a.price))[0],
    };
  }, [matches]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Item Comparison</h1>
        <p className="text-muted-foreground text-sm">Search an item to compare its price across all stores.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="e.g. Margherita, Bolognaise..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      {!q && (
        <Card>
          <CardHeader><CardTitle className="text-base">Popular items (offered by 5+ stores)</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Badge key={s} variant="secondary" className="cursor-pointer hover:bg-primary hover:text-primary-foreground" onClick={() => setQ(s)}>{s}</Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {isLoading ? <Skeleton className="h-64" /> : matches.length === 0 && q ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No items match "{q}".</CardContent></Card>
      ) : matches.length > 0 && (
        <>
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Stores offering" value={stats.count.toString()} />
              <Stat label="Avg price" value={formatZAR(stats.avg)} />
              <Stat label="Cheapest" value={formatZAR(stats.min)} sub={stats.cheapestStore?.stores.name} icon={TrendingDown} positive />
              <Stat label="Most expensive" value={formatZAR(stats.max)} sub={stats.priciestStore?.stores.name} icon={TrendingUp} />
            </div>
          )}

          {chartData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Price across stores</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 28)}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-xs" tickFormatter={(v) => `R${v}`} />
                    <YAxis dataKey="store" type="category" width={140} className="text-xs" />
                    <Tooltip formatter={(v: any) => formatZAR(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="price" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">All matches</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Store</TableHead><TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader>
                <TableBody>
                  {matches.sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0)).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.stores.name}</TableCell>
                      <TableCell className="font-medium">{decodeText(m.name)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{decodeText(m.category ?? "")}</TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap">{formatZAR(Number(m.price))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, icon: Icon, positive }: { label: string; value: string; sub?: string; icon?: any; positive?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
          {Icon && <Icon className={`h-4 w-4 ${positive ? "text-accent" : "text-primary"}`} />}
        </div>
        <div className="text-xl font-bold mt-1">{value}</div>
        {sub && <div className="text-xs text-muted-foreground truncate mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
