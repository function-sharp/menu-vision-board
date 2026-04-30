import { useMemo, useState } from "react";
import { useAllItems, useStores } from "@/hooks/useDashboardData";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { formatZAR, decodeText } from "@/lib/format";
import { Search, Download, Bookmark, BookmarkPlus, X, MoreVertical, Trash2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const PAGE_SIZE = 50;

type Filters = {
  q: string;
  storeFilter: string;
  categoryFilter: string;
  groupFilter: string;
};

const EMPTY: Filters = { q: "", storeFilter: "all", categoryFilter: "all", groupFilter: "all" };

const QUICK_PRESETS: Array<{ name: string; filters: Filters }> = [
  { name: "Pizzas", filters: { ...EMPTY, q: "pizza" } },
  { name: "Pasta dishes", filters: { ...EMPTY, q: "pasta" } },
  { name: "GO stores only", filters: { ...EMPTY, groupFilter: "Go" } },
  { name: "Classic stores", filters: { ...EMPTY, groupFilter: "Classic" } },
  { name: "Margherita variants", filters: { ...EMPTY, q: "margherita" } },
];

export default function MenuBrowser() {
  const { data: items, isLoading } = useAllItems();
  const { data: stores } = useStores();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(0);
  const [saveOpen, setSaveOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const updateFilter = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
    setActivePresetId(null);
  };

  const { data: presets } = useQuery({
    queryKey: ["menu-presets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_filter_presets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const savePreset = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("menu_filter_presets").insert({
        name,
        search_query: filters.q || null,
        store_slug: filters.storeFilter === "all" ? null : filters.storeFilter,
        category: filters.categoryFilter === "all" ? null : filters.categoryFilter,
        store_group: filters.groupFilter === "all" ? null : filters.groupFilter,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Preset saved");
      qc.invalidateQueries({ queryKey: ["menu-presets"] });
      setSaveOpen(false);
      setPresetName("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const deletePreset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_filter_presets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      toast.success("Preset deleted");
      qc.invalidateQueries({ queryKey: ["menu-presets"] });
      if (activePresetId === id) setActivePresetId(null);
    },
  });

  const applyPreset = (p: any, id: string | null) => {
    setFilters({
      q: p.search_query ?? "",
      storeFilter: p.store_slug ?? "all",
      categoryFilter: p.category ?? "all",
      groupFilter: p.store_group ?? "all",
    });
    setPage(0);
    setActivePresetId(id);
  };

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
    const ql = filters.q.toLowerCase();
    return items.filter((i) => {
      if (filters.q && !i.name.toLowerCase().includes(ql) && !(i.description ?? "").toLowerCase().includes(ql)) return false;
      if (filters.storeFilter !== "all" && i.stores.slug !== filters.storeFilter) return false;
      if (filters.categoryFilter !== "all" && i.category !== filters.categoryFilter) return false;
      if (filters.groupFilter !== "all" && i.stores.store_group !== filters.groupFilter) return false;
      return true;
    });
  }, [items, filters]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const hasFilters = filters.q !== "" || filters.storeFilter !== "all" || filters.categoryFilter !== "all" || filters.groupFilter !== "all";

  const exportCsv = () => {
    const headers = ["Store", "Group", "Category", "Item", "Description", "Price (ZAR)", "Uber Eats URL"];
    const rows = filtered.map((i) => [
      i.stores.name, i.stores.store_group ?? "", i.category ?? "", decodeText(i.name),
      decodeText(i.description ?? "").replace(/\n/g, " "), i.price ?? "",
      i.deep_link ?? i.stores.uber_eats_url ?? "",
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
        <div className="flex gap-2">
          <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!hasFilters}>
                <BookmarkPlus className="h-4 w-4 mr-2" /> Save preset
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Save filter preset</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="preset-name">Name</Label>
                  <Input
                    id="preset-name"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="e.g. Cape Town pizzas"
                    onKeyDown={(e) => { if (e.key === "Enter" && presetName.trim()) savePreset.mutate(presetName.trim()); }}
                  />
                </div>
                <div className="rounded-md bg-muted p-3 text-xs space-y-1">
                  <div className="font-medium text-foreground mb-1">Filters being saved:</div>
                  <FilterSummary filters={filters} stores={stores ?? []} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
                <Button onClick={() => savePreset.mutate(presetName.trim())} disabled={!presetName.trim() || savePreset.isPending}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Preset chips */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1.5 mr-1">Quick</span>
            {QUICK_PRESETS.map((p) => (
              <Badge
                key={p.name}
                variant="outline"
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground hover:border-primary"
                onClick={() => applyPreset(
                  { search_query: p.filters.q, store_slug: p.filters.storeFilter === "all" ? null : p.filters.storeFilter, category: p.filters.categoryFilter === "all" ? null : p.filters.categoryFilter, store_group: p.filters.groupFilter === "all" ? null : p.filters.groupFilter },
                  null
                )}
              >
                {p.name}
              </Badge>
            ))}
          </div>
          {presets && presets.length > 0 && (
            <div className="flex items-start gap-2 flex-wrap pt-2 border-t">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1.5 mr-1">Saved</span>
              {presets.map((p: any) => (
                <div key={p.id} className={`group inline-flex items-center rounded-full border text-xs transition-colors ${activePresetId === p.id ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                  <button onClick={() => applyPreset(p, p.id)} className="flex items-center gap-1.5 pl-3 pr-2 py-1">
                    <Bookmark className="h-3 w-3" />
                    {p.name}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`px-1.5 py-1 rounded-r-full ${activePresetId === p.id ? "hover:bg-primary-foreground/20" : "hover:bg-muted-foreground/10"}`}>
                        <MoreVertical className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => deletePreset.mutate(p.id)} className="text-destructive">
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete preset
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
          {hasFilters && (
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-xs text-muted-foreground">
                <FilterSummary filters={filters} stores={stores ?? []} />
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setFilters(EMPTY); setPage(0); setActivePresetId(null); }}>
                <X className="h-3.5 w-3.5 mr-1" /> Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search items..." value={filters.q} onChange={(e) => updateFilter({ q: e.target.value })} className="pl-9" />
          </div>
          <Select value={filters.storeFilter} onValueChange={(v) => updateFilter({ storeFilter: v })}>
            <SelectTrigger><SelectValue placeholder="Store" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All stores</SelectItem>{stores?.map((s) => <SelectItem key={s.id} value={s.slug}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.categoryFilter} onValueChange={(v) => updateFilter({ categoryFilter: v })}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map((c) => <SelectItem key={c} value={c}>{decodeText(c)}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.groupFilter} onValueChange={(v) => updateFilter({ groupFilter: v })}>
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
                    <TableHead className="text-right">Uber Eats</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((i) => {
                    const url = i.deep_link ?? i.stores.uber_eats_url ?? null;
                    const isItemLink = !!i.deep_link;
                    return (
                      <TableRow
                        key={i.id}
                        onClick={() => setSelectedItem(i)}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell className="max-w-xs">
                          <div className="font-medium">{decodeText(i.name)}</div>
                          {i.description && <div className="text-xs text-muted-foreground line-clamp-1">{decodeText(i.description)}</div>}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Link className="hover:text-primary hover:underline" to={`/stores/${i.stores.slug}`}>{i.stores.name}</Link>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{decodeText(i.category ?? "")}</TableCell>
                        <TableCell className="text-right font-semibold whitespace-nowrap">{formatZAR(Number(i.price))}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={isItemLink ? "Open this item on Uber Eats" : "Open store on Uber Eats"}
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline whitespace-nowrap"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              {isItemLink ? "Item" : "Store"}
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

      <Dialog open={!!selectedItem} onOpenChange={(o) => !o && setSelectedItem(null)}>
        <DialogContent className="max-w-lg">
          {selectedItem && (() => {
            const url = selectedItem.deep_link ?? selectedItem.stores.uber_eats_url ?? null;
            const isItemLink = !!selectedItem.deep_link;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="pr-6">{decodeText(selectedItem.name)}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.category && <Badge variant="outline">{decodeText(selectedItem.category)}</Badge>}
                    {selectedItem.stores.store_group && <Badge variant="outline">{selectedItem.stores.store_group}</Badge>}
                    {selectedItem.price != null && (
                      <Badge className="bg-primary text-primary-foreground">{formatZAR(Number(selectedItem.price))}</Badge>
                    )}
                  </div>

                  <div className="text-sm">
                    <span className="text-muted-foreground">Available at </span>
                    <Link
                      to={`/stores/${selectedItem.stores.slug}`}
                      onClick={() => setSelectedItem(null)}
                      className="font-medium text-primary hover:underline"
                    >
                      {selectedItem.stores.name}
                    </Link>
                  </div>

                  {selectedItem.description && (
                    <div className="text-sm text-muted-foreground whitespace-pre-line border-l-2 border-muted pl-3">
                      {decodeText(selectedItem.description)}
                    </div>
                  )}

                  <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Uber Eats link</div>
                    {url ? (
                      <>
                        <div className="text-xs">
                          <Badge variant={isItemLink ? "default" : "secondary"} className="mr-2">
                            {isItemLink ? "Item-level" : "Store-level"}
                          </Badge>
                          <span className="text-muted-foreground">
                            {isItemLink ? "Opens this exact item on Uber Eats." : "Item link unavailable — opens the store page on Uber Eats."}
                          </span>
                        </div>
                        <div className="text-xs font-mono break-all text-muted-foreground">{url}</div>
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground">No Uber Eats link available for this item or store.</div>
                    )}
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setSelectedItem(null)}>Close</Button>
                  {url && (
                    <Button asChild>
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" /> Open on Uber Eats
                      </a>
                    </Button>
                  )}
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterSummary({ filters, stores }: { filters: Filters; stores: any[] }) {
  const parts: string[] = [];
  if (filters.q) parts.push(`search: "${filters.q}"`);
  if (filters.storeFilter !== "all") {
    const s = stores.find((x) => x.slug === filters.storeFilter);
    parts.push(`store: ${s?.name ?? filters.storeFilter}`);
  }
  if (filters.categoryFilter !== "all") parts.push(`category: ${decodeText(filters.categoryFilter)}`);
  if (filters.groupFilter !== "all") parts.push(`group: ${filters.groupFilter}`);
  return <span>{parts.length === 0 ? "No filters" : parts.join(" · ")}</span>;
}
