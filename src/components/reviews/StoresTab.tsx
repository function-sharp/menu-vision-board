import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useGooglePlaces, useStoreReviewStats } from "@/hooks/useReviews";
import { useStores } from "@/hooks/useDashboardData";
import { Stars } from "@/components/StarDistribution";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, Search } from "lucide-react";
import { useScopedStoreIds, type ReviewScope, defaultScope } from "./ReviewFiltersBar";
import { ComparisonPanel } from "./ComparisonPanel";
import { toast } from "sonner";

const MAX_COMPARE = 5;

type SortKey = "name" | "group" | "reviews" | "avg_stars" | "reviews_30d" | "avg_30d" | "response_rate" | "avg_reply_days" | "last_review_at";

function compare(a: any, b: any, dir: "asc" | "desc") {
  const an = a == null || a === "";
  const bn = b == null || b === "";
  if (an && bn) return 0;
  if (an) return 1;
  if (bn) return -1;
  const cmp = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true });
  return dir === "asc" ? cmp : -cmp;
}

export function StoresTab({ scope = defaultScope }: { scope?: ReviewScope }) {
  const { data: stats, isLoading } = useStoreReviewStats();
  const { data: stores } = useStores();
  const { data: places } = useGooglePlaces();
  const { storeId: scopedStoreId, storeIds: scopedStoreIds } = useScopedStoreIds(scope);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("reviews");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareRange, setCompareRange] = useState<string>("24m");

  const toggleSelect = (storeId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(storeId)) return prev.filter((id) => id !== storeId);
      if (prev.length >= MAX_COMPARE) {
        toast.info(`You can compare up to ${MAX_COMPARE} stores at once`);
        return prev;
      }
      return [...prev, storeId];
    });
  };

  const groups = useMemo(
    () => Array.from(new Set((stores ?? []).map((s) => s.store_group).filter(Boolean))) as string[],
    [stores],
  );
  const cities = useMemo(
    () => Array.from(new Set((places ?? []).map((p) => p.city).filter(Boolean))).sort() as string[],
    [places],
  );
  const cityByStore = useMemo(() => {
    const m = new Map<string, string | null>();
    (places ?? []).forEach((p) => { if (p.store_id) m.set(p.store_id, p.city ?? null); });
    return m;
  }, [places]);

  const rows = useMemo(() => {
    if (!stats || !stores) return [];
    const storeMap = new Map(stores.map((s) => [s.id, s]));
    let rs = stats
      .filter((s) => storeMap.has(s.store_id))
      .map((s) => {
        const store = storeMap.get(s.store_id)!;
        return { ...s, name: store.name, slug: store.slug, group: store.store_group, city: cityByStore.get(s.store_id) ?? null };
      });
    // Apply page-level scope first
    if (scopedStoreId) rs = rs.filter((r) => r.store_id === scopedStoreId);
    else if (scopedStoreIds && scopedStoreIds.length > 0) {
      const set = new Set(scopedStoreIds);
      rs = rs.filter((r) => set.has(r.store_id));
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      rs = rs.filter((r) => r.name.toLowerCase().includes(q) || (r.group ?? "").toLowerCase().includes(q) || (r.city ?? "").toLowerCase().includes(q));
    }
    if (groupFilter !== "all") rs = rs.filter((r) => r.group === groupFilter);
    if (cityFilter !== "all") rs = rs.filter((r) => r.city === cityFilter);
    rs.sort((a, b) => {
      switch (sortKey) {
        case "name": return compare(a.name, b.name, sortDir);
        case "group": return compare(a.group, b.group, sortDir);
        case "reviews": return compare(a.reviews, b.reviews, sortDir);
        case "avg_stars": return compare(a.avg_stars, b.avg_stars, sortDir);
        case "reviews_30d": return compare(a.reviews_30d, b.reviews_30d, sortDir);
        case "avg_30d": return compare(a.avg_stars_30d, b.avg_stars_30d, sortDir);
        case "response_rate": return compare(a.response_rate, b.response_rate, sortDir);
        case "avg_reply_days": return compare(a.avg_reply_days, b.avg_reply_days, sortDir);
        case "last_review_at": return compare(a.last_review_at, b.last_review_at, sortDir);
      }
    });
    return rs;
  }, [stats, stores, cityByStore, query, groupFilter, cityFilter, sortKey, sortDir, scopedStoreId, scopedStoreIds]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "name" || k === "group" ? "asc" : "desc"); }
  };

  const selectedStoreInfos = useMemo(() => {
    const map = new Map((stores ?? []).map((s) => [s.id, s.name] as const));
    return selectedIds
      .filter((id) => map.has(id))
      .map((id) => ({ id, name: map.get(id)! }));
  }, [selectedIds, stores]);

  return (
    <div className="space-y-4">
      {selectedStoreInfos.length > 0 && (
        <ComparisonPanel
          selectedStores={selectedStoreInfos}
          range={compareRange}
          onRangeChange={setCompareRange}
          onRemove={(id) => setSelectedIds((prev) => prev.filter((x) => x !== id))}
          onClear={() => setSelectedIds([])}
        />
      )}
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="grid md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search stores, city, group…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger><SelectValue placeholder="Group" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All groups</SelectItem>
              {groups.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger><SelectValue placeholder="City" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cities</SelectItem>
              {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <Skeleton className="h-96" />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><span className="sr-only">Compare</span></TableHead>
                  <SortHead label="Store" k="name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <SortHead label="Group" k="group" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <TableHead>City</TableHead>
                  <SortHead label="Reviews" k="reviews" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                  <SortHead label="Avg ★" k="avg_stars" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                  <SortHead label="30d count" k="reviews_30d" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                  <SortHead label="30d avg" k="avg_30d" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                  <SortHead label="Reply rate" k="response_rate" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                  <SortHead label="Avg reply" k="avg_reply_days" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                  <SortHead label="Last review" k="last_review_at" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-sm text-muted-foreground py-8">
                      No stores match.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => {
                  const checked = selectedIds.includes(r.store_id);
                  const disabled = !checked && selectedIds.length >= MAX_COMPARE;
                  return (
                  <TableRow key={r.store_id} className={checked ? "bg-primary/5" : ""}>
                    <TableCell className="w-10">
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={() => toggleSelect(r.store_id)}
                        aria-label={`Compare ${r.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link to={`/stores/${r.slug}`} className="font-medium hover:text-primary hover:underline">
                        {r.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.group ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.city ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.reviews.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Stars value={r.avg_stars} size={10} />
                        <span className="tabular-nums w-9 text-right">{r.avg_stars.toFixed(2)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.reviews_30d.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.avg_stars_30d != null ? r.avg_stars_30d.toFixed(2) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{Math.round(r.response_rate * 100)}%</TableCell>
                    <TableCell className="text-right tabular-nums">{r.avg_reply_days != null ? `${r.avg_reply_days.toFixed(1)}d` : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.last_review_at ? new Date(r.last_review_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/stores/${r.slug}`} className="inline-flex items-center text-primary text-xs hover:underline">
                        <ExternalLink className="h-3 w-3 mr-1" /> View
                      </Link>
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
    </div>
  );
}

function SortHead({
  label, k, sortKey, sortDir, onClick, align = "left",
}: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: "asc" | "desc"; onClick: (k: SortKey) => void; align?: "left" | "right";
}) {
  const active = sortKey === k;
  return (
    <TableHead className={align === "right" ? "text-right" : ""}>
      <button
        type="button"
        onClick={() => onClick(k)}
        className={`inline-flex items-center gap-1 ${align === "right" ? "ml-auto flex-row-reverse" : ""} hover:text-foreground transition-colors ${active ? "text-foreground" : ""}`}
      >
        {label}
        {!active && <ArrowUpDown className="h-3 w-3 opacity-50" />}
        {active && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </TableHead>
  );
}
