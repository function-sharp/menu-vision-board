import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStores, useAllItems } from "@/hooks/useDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatZAR, decodeText } from "@/lib/format";
import { ExternalLink, Copy, Search, Download, Link2, AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

type ItemLinkFilter = "any" | "item" | "store_fallback";

type SortDir = "asc" | "desc";
type StoreSortKey = "name" | "store_group" | "item_count" | "uber_eats_url";
type ItemSortKey = "name" | "store" | "category" | "price" | "link";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

function compare(a: any, b: any, dir: SortDir): number {
  const aNull = a === null || a === undefined || a === "";
  const bNull = b === null || b === undefined || b === "";
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  const cmp = typeof a === "number" && typeof b === "number"
    ? a - b
    : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  return dir === "asc" ? cmp : -cmp;
}

function copyUrl(url: string) {
  navigator.clipboard.writeText(url).then(
    () => toast.success("Link copied"),
    () => toast.error("Could not copy link"),
  );
}

function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function UberEats() {
  const { data: stores, isLoading: storesLoading } = useStores();
  const { data: items, isLoading: itemsLoading } = useAllItems();

  // Stores section state
  const [storeQuery, setStoreQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [showMissing, setShowMissing] = useState(false);
  const [storeSortKey, setStoreSortKey] = useState<StoreSortKey>("name");
  const [storeSortDir, setStoreSortDir] = useState<SortDir>("asc");
  const [storePage, setStorePage] = useState(0);
  const [storePageSize, setStorePageSize] = useState(50);

  // Items section state
  const [itemQuery, setItemQuery] = useState("");
  const [itemStoreFilter, setItemStoreFilter] = useState<string>("all");
  const [linkFilter, setLinkFilter] = useState<ItemLinkFilter>("any");
  const [itemSortKey, setItemSortKey] = useState<ItemSortKey>("name");
  const [itemSortDir, setItemSortDir] = useState<SortDir>("asc");
  const [itemPage, setItemPage] = useState(0);
  const [itemPageSize, setItemPageSize] = useState(50);

  const toggleStoreSort = (key: StoreSortKey) => {
    if (storeSortKey === key) setStoreSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setStoreSortKey(key); setStoreSortDir("asc"); }
    setStorePage(0);
  };
  const toggleItemSort = (key: ItemSortKey) => {
    if (itemSortKey === key) setItemSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setItemSortKey(key); setItemSortDir("asc"); }
    setItemPage(0);
  };

  const groups = useMemo(
    () => Array.from(new Set((stores ?? []).map((s) => s.store_group).filter(Boolean))) as string[],
    [stores],
  );

  // Coverage stats
  const stats = useMemo(() => {
    const total = stores?.length ?? 0;
    const withLink = (stores ?? []).filter((s) => !!s.uber_eats_url).length;
    const totalItems = items?.length ?? 0;
    const itemLinkCount = (items ?? []).filter((i) => !!i.deep_link).length;
    const storeFallbackCount = (items ?? []).filter((i) => !i.deep_link && !!i.stores.uber_eats_url).length;
    return { total, withLink, totalItems, itemLinkCount, storeFallbackCount };
  }, [stores, items]);

  const filteredStores = useMemo(() => {
    let list = stores ?? [];
    if (!showMissing) list = list.filter((s) => !!s.uber_eats_url);
    if (groupFilter !== "all") list = list.filter((s) => s.store_group === groupFilter);
    if (storeQuery) {
      const q = storeQuery.toLowerCase();
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || (s.store_group ?? "").toLowerCase().includes(q),
      );
    }
    const sorted = [...list].sort((a, b) => {
      switch (storeSortKey) {
        case "name": return compare(a.name, b.name, storeSortDir);
        case "store_group": return compare(a.store_group, b.store_group, storeSortDir);
        case "item_count": return compare(a.item_count, b.item_count, storeSortDir);
        case "uber_eats_url": return compare(a.uber_eats_url, b.uber_eats_url, storeSortDir);
      }
    });
    return sorted;
  }, [stores, showMissing, groupFilter, storeQuery, storeSortKey, storeSortDir]);

  const filteredItems = useMemo(() => {
    let list = (items ?? []).filter((i) => !!i.deep_link || !!i.stores.uber_eats_url);
    if (linkFilter === "item") list = list.filter((i) => !!i.deep_link);
    if (linkFilter === "store_fallback") list = list.filter((i) => !i.deep_link && !!i.stores.uber_eats_url);
    if (itemStoreFilter !== "all") list = list.filter((i) => i.stores.slug === itemStoreFilter);
    if (itemQuery) {
      const q = itemQuery.toLowerCase();
      list = list.filter(
        (i) => i.name.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q),
      );
    }
    const sorted = [...list].sort((a, b) => {
      switch (itemSortKey) {
        case "name": return compare(a.name, b.name, itemSortDir);
        case "store": return compare(a.stores.name, b.stores.name, itemSortDir);
        case "category": return compare(a.category, b.category, itemSortDir);
        case "price":
          return compare(
            a.price == null ? null : Number(a.price),
            b.price == null ? null : Number(b.price),
            itemSortDir,
          );
        case "link": return compare(a.deep_link ? 0 : 1, b.deep_link ? 0 : 1, itemSortDir);
      }
    });
    return sorted;
  }, [items, linkFilter, itemStoreFilter, itemQuery, itemSortKey, itemSortDir]);

  const exportStores = () => {
    downloadCsv(
      "uber-eats-stores.csv",
      ["Store", "Group", "Items", "Uber Eats URL"],
      filteredStores.map((s) => [s.name, s.store_group ?? "", s.item_count, s.uber_eats_url ?? ""]),
    );
  };

  const exportItems = () => {
    downloadCsv(
      "uber-eats-items.csv",
      ["Store", "Group", "Category", "Item", "Price (ZAR)", "Link type", "Uber Eats URL"],
      filteredItems.map((i) => [
        i.stores.name,
        i.stores.store_group ?? "",
        i.category ?? "",
        decodeText(i.name),
        i.price ?? "",
        i.deep_link ? "Item" : "Store",
        i.deep_link ?? i.stores.uber_eats_url ?? "",
      ]),
    );
  };

  const storeTotalPages = Math.max(1, Math.ceil(filteredStores.length / storePageSize));
  const safeStorePage = Math.min(storePage, storeTotalPages - 1);
  const pagedStores = filteredStores.slice(safeStorePage * storePageSize, (safeStorePage + 1) * storePageSize);

  const itemTotalPages = Math.max(1, Math.ceil(filteredItems.length / itemPageSize));
  const safeItemPage = Math.min(itemPage, itemTotalPages - 1);
  const pagedItems = filteredItems.slice(safeItemPage * itemPageSize, (safeItemPage + 1) * itemPageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Uber Eats</h1>
        <p className="text-muted-foreground text-sm">
          Browse all stores and menu items connected to Uber Eats. Open listings or copy links directly.
        </p>
      </div>

      {/* Coverage stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label="Stores with Uber Eats link"
          value={`${stats.withLink} / ${stats.total}`}
          sub={stats.total ? `${Math.round((stats.withLink / stats.total) * 100)}% coverage` : ""}
          loading={storesLoading}
        />
        <StatCard
          label="Items with item-level link"
          value={stats.itemLinkCount.toLocaleString()}
          sub={stats.totalItems ? `of ${stats.totalItems.toLocaleString()} items` : ""}
          loading={itemsLoading}
        />
        <StatCard
          label="Items using store fallback"
          value={stats.storeFallbackCount.toLocaleString()}
          sub="No item deep link, store link used"
          loading={itemsLoading}
        />
      </div>

      {/* Stores section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Stores</CardTitle>
          <Button variant="outline" size="sm" onClick={exportStores} disabled={!filteredStores.length}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stores..."
                value={storeQuery}
                onChange={(e) => { setStoreQuery(e.target.value); setStorePage(0); }}
                className="pl-9"
              />
            </div>
            <Select value={groupFilter} onValueChange={(v) => { setGroupFilter(v); setStorePage(0); }}>
              <SelectTrigger><SelectValue placeholder="Group" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All groups</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="show-missing" checked={showMissing} onCheckedChange={(v) => { setShowMissing(v); setStorePage(0); }} />
            <Label htmlFor="show-missing" className="text-sm font-normal cursor-pointer">
              Show stores missing an Uber Eats link
            </Label>
          </div>

          {storesLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <SortHeader label="Store" active={storeSortKey === "name"} dir={storeSortDir} onClick={() => toggleStoreSort("name")} />
                      </TableHead>
                      <TableHead>
                        <SortHeader label="Group" active={storeSortKey === "store_group"} dir={storeSortDir} onClick={() => toggleStoreSort("store_group")} />
                      </TableHead>
                      <TableHead className="text-right">
                        <SortHeader label="Items" align="right" active={storeSortKey === "item_count"} dir={storeSortDir} onClick={() => toggleStoreSort("item_count")} />
                      </TableHead>
                      <TableHead>
                        <SortHeader label="Uber Eats URL" active={storeSortKey === "uber_eats_url"} dir={storeSortDir} onClick={() => toggleStoreSort("uber_eats_url")} />
                      </TableHead>
                      <TableHead className="text-right w-48">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedStores.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                          No stores match these filters.
                        </TableCell>
                      </TableRow>
                    )}
                    {pagedStores.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Link to={`/stores/${s.slug}`} className="font-medium hover:text-primary hover:underline">
                            {s.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{s.store_group ?? "—"}</TableCell>
                        <TableCell className="text-right text-sm">{s.item_count}</TableCell>
                        <TableCell className="max-w-md">
                          {s.uber_eats_url ? (
                            <span className="text-xs font-mono text-muted-foreground truncate block">
                              {s.uber_eats_url}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3" /> Missing
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {s.uber_eats_url ? (
                            <div className="flex justify-end gap-1">
                              <Button asChild size="sm" variant="outline">
                                <a href={s.uber_eats_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
                                </a>
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => copyUrl(s.uber_eats_url!)}>
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <PaginationBar
                page={safeStorePage}
                totalPages={storeTotalPages}
                pageSize={storePageSize}
                totalRows={filteredStores.length}
                onPageChange={setStorePage}
                onPageSizeChange={(n) => { setStorePageSize(n); setStorePage(0); }}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Items section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Menu items with Uber Eats links</CardTitle>
          <Button variant="outline" size="sm" onClick={exportItems} disabled={!filteredItems.length}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={itemQuery}
                onChange={(e) => { setItemQuery(e.target.value); setItemsShown(PAGE_SIZE); }}
                className="pl-9"
              />
            </div>
            <Select value={itemStoreFilter} onValueChange={(v) => { setItemStoreFilter(v); setItemsShown(PAGE_SIZE); }}>
              <SelectTrigger><SelectValue placeholder="Store" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stores</SelectItem>
                {stores?.filter((s) => !!s.uber_eats_url).map((s) => (
                  <SelectItem key={s.id} value={s.slug}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={linkFilter} onValueChange={(v) => { setLinkFilter(v as ItemLinkFilter); setItemsShown(PAGE_SIZE); }}>
              <SelectTrigger><SelectValue placeholder="Link type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any link</SelectItem>
                <SelectItem value="item">Item-level only</SelectItem>
                <SelectItem value="store_fallback">Store fallback only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground">
            {filteredItems.length.toLocaleString()} items match
          </div>

          {itemsLoading ? (
            <Skeleton className="h-96" />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead className="text-right w-40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                        No items match these filters.
                      </TableCell>
                    </TableRow>
                  )}
                  {visibleItems.map((i) => {
                    const url = i.deep_link ?? i.stores.uber_eats_url!;
                    const isItem = !!i.deep_link;
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="max-w-xs">
                          <div className="font-medium text-sm">{decodeText(i.name)}</div>
                          {i.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">{decodeText(i.description)}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link to={`/stores/${i.stores.slug}`} className="text-sm hover:text-primary hover:underline">
                            {i.stores.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{decodeText(i.category ?? "")}</TableCell>
                        <TableCell className="text-right font-semibold whitespace-nowrap">
                          {i.price != null ? formatZAR(Number(i.price)) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isItem ? "default" : "secondary"} className="text-xs">
                            {isItem ? "Item" : "Store"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button asChild size="sm" variant="outline">
                              <a href={url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
                              </a>
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => copyUrl(url)}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {itemsShown < filteredItems.length && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={() => setItemsShown((n) => n + PAGE_SIZE)}>
                Load more ({filteredItems.length - itemsShown} remaining)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
          <Link2 className="h-3.5 w-3.5" /> {label}
        </div>
        {loading ? (
          <Skeleton className="h-7 w-24 mt-2" />
        ) : (
          <div className="text-2xl font-bold mt-1">{value}</div>
        )}
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
