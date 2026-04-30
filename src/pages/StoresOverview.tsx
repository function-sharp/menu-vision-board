import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStores, useAllItems } from "@/hooks/useDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatZAR } from "@/lib/format";
import {
  Store as StoreIcon,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Star,
  Utensils,
  Link2,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

type SortKey =
  | "name"
  | "store_group"
  | "items"
  | "categories"
  | "avg_price"
  | "min_price"
  | "max_price"
  | "linked_pct"
  | "rating";
type SortDir = "asc" | "desc";

type Row = {
  id: string;
  slug: string;
  name: string;
  store_group: string | null;
  rating: number | null;
  rating_count: number | null;
  uber_eats_url: string | null;
  items: number;
  categories: number;
  avg_price: number | null;
  min_price: number | null;
  max_price: number | null;
  linked_pct: number; // 0..1, items with deep_link
};

export default function StoresOverview() {
  const { data: stores, isLoading: storesLoading } = useStores();
  const { data: items, isLoading: itemsLoading } = useAllItems();

  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("items");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const groups = useMemo(() => {
    if (!stores) return [];
    return Array.from(new Set(stores.map((s) => s.store_group).filter(Boolean))) as string[];
  }, [stores]);

  const rows: Row[] = useMemo(() => {
    if (!stores) return [];
    const byStore = new Map<string, { prices: number[]; cats: Set<string>; linked: number; total: number }>();
    for (const it of items ?? []) {
      const m = byStore.get(it.store_id) ?? { prices: [], cats: new Set(), linked: 0, total: 0 };
      m.total += 1;
      if (it.price != null) m.prices.push(Number(it.price));
      if (it.category) m.cats.add(it.category);
      if (it.deep_link) m.linked += 1;
      byStore.set(it.store_id, m);
    }
    return stores.map((s) => {
      const agg = byStore.get(s.id);
      const prices = agg?.prices ?? [];
      const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
      return {
        id: s.id,
        slug: s.slug,
        name: s.name,
        store_group: s.store_group,
        rating: s.rating,
        rating_count: s.rating_count,
        uber_eats_url: s.uber_eats_url,
        items: agg?.total ?? s.item_count,
        categories: agg?.cats.size ?? 0,
        avg_price: avg,
        min_price: prices.length ? Math.min(...prices) : null,
        max_price: prices.length ? Math.max(...prices) : null,
        linked_pct: agg && agg.total > 0 ? agg.linked / agg.total : 0,
      };
    });
  }, [stores, items]);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    let r = rows.filter((row) => {
      const matchQ = !q || row.name.toLowerCase().includes(ql) || (row.store_group ?? "").toLowerCase().includes(ql);
      const matchG = group === "all" || row.store_group === group;
      return matchQ && matchG;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    const cmp = (a: Row, b: Row): number => {
      const get = (x: Row): number | string | null => {
        switch (sortKey) {
          case "name":
            return x.name.toLowerCase();
          case "store_group":
            return (x.store_group ?? "").toLowerCase();
          case "items":
            return x.items;
          case "categories":
            return x.categories;
          case "avg_price":
            return x.avg_price ?? -Infinity;
          case "min_price":
            return x.min_price ?? Infinity;
          case "max_price":
            return x.max_price ?? -Infinity;
          case "linked_pct":
            return x.linked_pct;
          case "rating":
            return x.rating ?? -Infinity;
        }
      };
      const av = get(a);
      const bv = get(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    };
    return [...r].sort(cmp);
  }, [rows, q, group, sortKey, sortDir]);

  const totals = useMemo(() => {
    const items = filtered.reduce((s, r) => s + r.items, 0);
    const linked = filtered.reduce((s, r) => s + Math.round(r.linked_pct * r.items), 0);
    const allPrices = filtered.flatMap((r) => (r.avg_price != null ? [r.avg_price] : []));
    const avgOfAvgs = allPrices.length ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : null;
    const ratings = filtered.flatMap((r) => (r.rating != null ? [r.rating] : []));
    const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
    return {
      stores: filtered.length,
      items,
      linkedPct: items ? linked / items : 0,
      avgOfAvgs,
      avgRating,
    };
  }, [filtered]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" || key === "store_group" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? (
      <ArrowUpDown className="h-3 w-3 inline ml-1 text-muted-foreground" />
    ) : sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 inline ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 inline ml-1" />
    );

  const isLoading = storesLoading || itemsLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <StoreIcon className="h-6 w-6" /> Stores Overview
          </h1>
          <p className="text-muted-foreground text-sm">
            Quick metrics per store. Click a row to drill into its menu.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Stores" value={isLoading ? "—" : totals.stores.toString()} />
        <Kpi label="Total items" value={isLoading ? "—" : totals.items.toLocaleString()} />
        <Kpi
          label="Avg price"
          value={isLoading || totals.avgOfAvgs == null ? "—" : formatZAR(totals.avgOfAvgs)}
        />
        <Kpi
          label="Avg rating"
          value={isLoading || totals.avgRating == null ? "—" : totals.avgRating.toFixed(2)}
        />
        <Kpi
          label="Linked items"
          value={isLoading ? "—" : `${Math.round(totals.linkedPct * 100)}%`}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search store or group..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All groups</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No stores match your filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                      Store <SortIcon k="name" />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("store_group")}>
                      Group <SortIcon k="store_group" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("items")}>
                      Items <SortIcon k="items" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("categories")}>
                      Categories <SortIcon k="categories" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("avg_price")}>
                      Avg price <SortIcon k="avg_price" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("min_price")}>
                      Min <SortIcon k="min_price" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("max_price")}>
                      Max <SortIcon k="max_price" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("linked_pct")}>
                      Linked <SortIcon k="linked_pct" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("rating")}>
                      Rating <SortIcon k="rating" />
                    </TableHead>
                    <TableHead className="w-[140px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id} className="group">
                      <TableCell>
                        <Link
                          to={`/stores/${r.slug}`}
                          className="font-medium hover:text-primary inline-flex items-center gap-1"
                        >
                          {r.name}
                          <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.store_group ? <Badge variant="outline">{r.store_group}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Utensils className="h-3 w-3 text-muted-foreground" />
                          {r.items.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.categories || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.avg_price != null ? formatZAR(r.avg_price) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                        {r.min_price != null ? formatZAR(r.min_price) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                        {r.max_price != null ? formatZAR(r.max_price) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <LinkedBar pct={r.linked_pct} />
                      </TableCell>
                      <TableCell className="text-right">
                        {r.rating != null ? (
                          <span className="inline-flex items-center gap-1 text-sm">
                            <Star className="h-3 w-3 fill-current text-primary" />
                            <span className="tabular-nums">{r.rating.toFixed(1)}</span>
                            {r.rating_count != null && (
                              <span className="text-xs text-muted-foreground">({r.rating_count})</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          {r.uber_eats_url && (
                            <Button asChild size="sm" variant="ghost" title="Open on Uber Eats">
                              <a href={r.uber_eats_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button asChild size="sm" variant="outline">
                            <Link to={`/stores/${r.slug}`}>View menu</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function LinkedBar({ pct }: { pct: number }) {
  const p = Math.round(pct * 100);
  return (
    <div className="inline-flex items-center gap-2 w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${p}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-9 text-right inline-flex items-center justify-end gap-0.5">
        <Link2 className="h-3 w-3" />
        {p}%
      </span>
    </div>
  );
}
