import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStoreBySlug, useStoreItems } from "@/hooks/useDashboardData";
import { useReviews, useReviewStats } from "@/hooks/useReviews";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReviewCard } from "@/components/ReviewCard";
import { Stars, StarDistribution } from "@/components/StarDistribution";
import { ReviewTrendChart } from "@/components/reviews/ReviewTrendChart";
import { StarDistributionTrendChart } from "@/components/reviews/StarDistributionTrendChart";
import { SentimentTrendChart } from "@/components/reviews/SentimentTrendChart";
import { formatZAR, decodeText } from "@/lib/format";
import { ArrowLeft, Star, MapPin, Phone, Search, ExternalLink, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StoreDetail() {
  const { slug } = useParams();
  const { data: store, isLoading: sl } = useStoreBySlug(slug);
  const { data: items, isLoading: il } = useStoreItems(store?.id);
  const [q, setQ] = useState("");

  const grouped = useMemo(() => {
    if (!items) return [] as Array<{ category: string; items: typeof items }>;
    const ql = q.toLowerCase();
    const filtered = items.filter((i) => !q || i.name.toLowerCase().includes(ql) || (i.description ?? "").toLowerCase().includes(ql));
    const map: Record<string, typeof items> = {};
    filtered.forEach((i) => {
      const c = i.category || "Other";
      if (!map[c]) map[c] = [] as any;
      (map[c] as any).push(i);
    });
    return Object.entries(map).map(([category, items]) => ({ category, items: items as any }));
  }, [items, q]);

  const stats = useMemo(() => {
    if (!items || items.length === 0) return null;
    const prices = items.filter((i) => i.price != null).map((i) => Number(i.price));
    return {
      avg: prices.reduce((a, b) => a + b, 0) / prices.length,
      min: Math.min(...prices),
      max: Math.max(...prices),
      cheapest: items.filter((i) => i.price != null).sort((a, b) => Number(a.price) - Number(b.price))[0],
      priciest: items.filter((i) => i.price != null).sort((a, b) => Number(b.price) - Number(a.price))[0],
    };
  }, [items]);

  if (sl) return <Skeleton className="h-64" />;
  if (!store) return <div>Store not found. <Link className="text-primary" to="/stores">Back to stores</Link></div>;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link to="/stores"><ArrowLeft className="h-4 w-4 mr-2" /> All stores</Link>
      </Button>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">{store.name}</h1>
              <div className="flex flex-wrap gap-2">
                {store.store_group && <Badge>{store.store_group}</Badge>}
                {store.price_range && <Badge variant="outline">{store.price_range}</Badge>}
                <Badge variant="outline">{store.item_count} items</Badge>
                {store.rating != null && (
                  <Badge variant="secondary" className="gap-1"><Star className="h-3 w-3 fill-current text-primary" /> {store.rating.toFixed(1)}</Badge>
                )}
              </div>
              {store.cuisine && <div className="text-sm text-muted-foreground">{store.cuisine}</div>}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {store.address && <div className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" /> {store.address}</div>}
            {store.telephone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> <a href={`tel:+${store.telephone}`} className="hover:underline">+{store.telephone}</a></div>}
          </div>
          {store.uber_eats_url && (
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="default" size="sm">
                <a href={store.uber_eats_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" /> Order on Uber Eats
                </a>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/uber-eats">View Uber Eats hub</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label="Avg price" value={formatZAR(stats.avg)} />
          <StatBox label="Cheapest" value={formatZAR(stats.min)} sub={stats.cheapest ? decodeText(stats.cheapest.name) : ""} />
          <StatBox label="Most expensive" value={formatZAR(stats.max)} sub={stats.priciest ? decodeText(stats.priciest.name) : ""} />
          <StatBox label="Categories" value={String(grouped.length)} />
        </div>
      )}

      <Tabs defaultValue="menu" className="space-y-4">
        <TabsList>
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="reviews">
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Reviews
          </TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search this menu..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>

          {il ? (
            <Skeleton className="h-96" />
          ) : (
            <Card>
              <CardHeader><CardTitle className="text-base">Menu</CardTitle></CardHeader>
              <CardContent>
                <Accordion type="multiple" defaultValue={grouped.slice(0, 3).map((g) => g.category)}>
                  {grouped.map((g) => {
                    const prices = g.items.filter((i: any) => i.price != null).map((i: any) => Number(i.price));
                    const min = Math.min(...prices);
                    const max = Math.max(...prices);
                    return (
                      <AccordionItem key={g.category} value={g.category}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex flex-1 items-center justify-between pr-3">
                            <span className="font-medium text-left">{decodeText(g.category)}</span>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{g.items.length} items</span>
                              {prices.length > 0 && <span>{formatZAR(min)} – {formatZAR(max)}</span>}
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2">
                            {g.items.map((it: any) => (
                              <div key={it.id} className="flex items-start justify-between gap-4 p-3 rounded-md hover:bg-muted/50">
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm">{decodeText(it.name)}</div>
                                  {it.description && <div className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{decodeText(it.description)}</div>}
                                </div>
                                <div className="text-sm font-semibold text-primary whitespace-nowrap">{formatZAR(Number(it.price))}</div>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reviews">
          <StoreReviewsTab storeId={store.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-xl font-bold mt-1">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1 truncate">{sub}</div>}
      </CardContent>
    </Card>
  );
}

const TREND_RANGES: Array<{ key: string; label: string; months: number }> = [
  { key: "3m", label: "3M", months: 3 },
  { key: "6m", label: "6M", months: 6 },
  { key: "12m", label: "12M", months: 12 },
  { key: "24m", label: "24M", months: 24 },
  { key: "36m", label: "36M", months: 36 },
];

function StoreReviewsTab({ storeId }: { storeId: string }) {
  const { data: stats } = useReviewStats(storeId);
  const { data: reviews, isLoading } = useReviews({ storeId, sortBy: "newest", limit: 100 });
  const [trendRange, setTrendRange] = useState("24m");
  const activeRange = TREND_RANGES.find((r) => r.key === trendRange) ?? TREND_RANGES[3];

  if (stats && stats.total === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No Google reviews linked to this store yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-1 flex-wrap">
        {TREND_RANGES.map((r) => (
          <Button
            key={r.key}
            variant={trendRange === r.key ? "default" : "outline"}
            size="sm"
            onClick={() => setTrendRange(r.key)}
            className="h-7 px-2.5 text-xs"
          >
            {r.label}
          </Button>
        ))}
      </div>
      <ReviewTrendChart
        storeId={storeId}
        months={activeRange.months}
        title={`Review trend — last ${activeRange.months} months`}
      />
      <StarDistributionTrendChart
        storeId={storeId}
        months={activeRange.months}
        title={`Rating distribution — last ${activeRange.months} months`}
      />
      <SentimentTrendChart
        storeId={storeId}
        months={activeRange.months}
        title={`Sentiment over time — last ${activeRange.months} months`}
      />
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Average rating</div>
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold">{stats ? stats.avgStars.toFixed(2) : "—"}</div>
              {stats && <Stars value={stats.avgStars} size={16} />}
            </div>
            <div className="text-xs text-muted-foreground">{stats?.total.toLocaleString() ?? 0} reviews</div>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Distribution</CardTitle></CardHeader>
          <CardContent>{stats ? <StarDistribution distribution={stats.distribution} /> : <Skeleton className="h-24" />}</CardContent>
        </Card>
      </div>
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : (
        <div className="grid gap-3">
          {(reviews ?? []).map((r) => <ReviewCard key={r.id} review={r} />)}
        </div>
      )}
    </div>
  );
}
