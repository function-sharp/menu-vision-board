import { useMemo, useState } from "react";
import { useAllItems, useStores } from "@/hooks/useDashboardData";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatZAR, decodeText } from "@/lib/format";
import { Search, Download } from "lucide-react";
import { Link } from "react-router-dom";

const PAGE_SIZE = 50;

export default function MenuBrowser() {
  const { data: items, isLoading } = useAllItems();
  const { data: stores } = useStores();
  const [q, setQ] = useState("");
  const [storeFilter, setStoreFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [page, setPage] = useState(0);

  const categories = useMemo(() => {
    if (!items) return [];
    return Array.from(new Set(items.map((i) => i.category).filter(Boolean))).sort() as string[];
  }, [items]);

  const groups = useMemo(() => {
    if (!stores) return [];
    return Array.from(new Set(stores.map((s) => s.store_group).filter(Boolean))) as string[];
  }, [stores]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const ql = q.toLowerCase();
    return items.filter((i) => {
      if (q && !i.name.toLowerCase().includes(ql) && !(i.description ?? "").toLowerCase().includes(ql)) return false;
      if (storeFilter !== "all" && i.stores.slug !== storeFilter) return false;
      if (categoryFilter !== "all" && i.category !== categoryFilter) return false;
      if (groupFilter !== "all" && i.stores.store_group !== groupFilter) return false;
      return true;
    });
  }, [items, q, storeFilter, categoryFilter, groupFilter]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const exportCsv = () => {
    const headers = ["Store", "Group", "Category", "Item", "Description", "Price (ZAR)"];
    const rows = filtered.map((i) => [
      i.stores.name, i.stores.store_group ?? "", i.category ?? "", decodeText(i.name),
      decodeText(i.description ?? "").replace(/\n/g, " "), i.price ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "menu-items.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Menu Browser</h1>
          <p className="text-muted-foreground text-sm">{filtered.length.toLocaleString()} items {filtered.length !== items?.length && `(of ${items?.length.toLocaleString()})`}</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search items..." value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} className="pl-9" />
          </div>
          <Select value={storeFilter} onValueChange={(v) => { setStoreFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Store" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All stores</SelectItem>{stores?.map((s) => <SelectItem key={s.id} value={s.slug}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map((c) => <SelectItem key={c} value={c}>{decodeText(c)}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={groupFilter} onValueChange={(v) => { setGroupFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Group" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All groups</SelectItem>{groups.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="max-w-xs">
                        <div className="font-medium">{decodeText(i.name)}</div>
                        {i.description && <div className="text-xs text-muted-foreground line-clamp-1">{decodeText(i.description)}</div>}
                      </TableCell>
                      <TableCell><Link className="hover:text-primary hover:underline" to={`/stores/${i.stores.slug}`}>{i.stores.name}</Link></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{decodeText(i.category ?? "")}</TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap">{formatZAR(Number(i.price))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">Page {page + 1} of {totalPages}</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
