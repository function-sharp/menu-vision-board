import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStores, useAllItems } from "@/hooks/useDashboardData";
import { useReviewSearch } from "@/hooks/useReviews";
import {
  Store as StoreIcon,
  Utensils,
  Tag,
  ExternalLink,
  MessageSquare,
  Star,
  Filter,
  X,
  Check,
} from "lucide-react";
import { formatZAR } from "@/lib/format";
import { cn } from "@/lib/utils";

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Score a string against a query: 3=prefix, 2=word-start, 1=contains, 0=miss
function scoreMatch(haystack: string | null | undefined, q: string): number {
  if (!haystack || !q) return 0;
  const h = haystack.toLowerCase();
  if (h.startsWith(q)) return 3;
  if (h.includes(` ${q}`) || h.includes(`-${q}`) || h.includes(`,${q}`)) return 2;
  if (h.includes(q)) return 1;
  return 0;
}

const MAX_STORES = 6;
const MAX_CATEGORIES = 6;
const MAX_ITEMS = 12;

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [storeFilter, setStoreFilter] = useState<string | null>(null); // store id
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [filterPanel, setFilterPanel] = useState<"store" | "category" | null>(null);

  const { data: stores } = useStores();
  const { data: items } = useAllItems();
  const { data: reviewMatches } = useReviewSearch(query, open);

  // Debounce typing for snappier autocomplete (avoid recomputing on every keystroke)
  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery.trim().toLowerCase()), 80);
    return () => clearTimeout(t);
  }, [rawQuery]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setRawQuery("");
      setQuery("");
      setStoreFilter(null);
      setCategoryFilter(null);
      setFilterPanel(null);
    }
  }, [open]);

  // All categories across the menu (sorted, deduped)
  const allCategories = useMemo(() => {
    if (!items) return [];
    const set = new Set<string>();
    for (const i of items) if (i.category) set.add(i.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const selectedStore = useMemo(
    () => stores?.find((s) => s.id === storeFilter) ?? null,
    [stores, storeFilter]
  );

  // Stores list — when no query, still show top stores so users can pick one as a filter
  const storeMatches = useMemo(() => {
    if (!stores) return [];
    if (!query) return [];
    const scored = stores
      .map((s) => {
        const score = Math.max(
          scoreMatch(s.name, query),
          scoreMatch(s.store_group, query),
          scoreMatch(s.cuisine, query),
          scoreMatch(s.address, query),
          scoreMatch(s.slug, query)
        );
        return { s, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name))
      .slice(0, MAX_STORES);
    return scored.map((x) => x.s);
  }, [stores, query]);

  const categoryMatches = useMemo(() => {
    if (!query) return [];
    const scored = allCategories
      .map((c) => ({ c, score: scoreMatch(c, query) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.c.localeCompare(b.c))
      .slice(0, MAX_CATEGORIES);
    return scored.map((x) => x.c);
  }, [allCategories, query]);

  const itemMatches = useMemo(() => {
    if (!items) return [];
    // With filters active, allow showing top items even with empty query
    const noQuery = query.length === 0;
    if (noQuery && !storeFilter && !categoryFilter) return [];

    const filtered = items.filter((i) => {
      if (storeFilter && i.store_id !== storeFilter) return false;
      if (categoryFilter && i.category !== categoryFilter) return false;
      return true;
    });

    if (noQuery) {
      return filtered.slice(0, MAX_ITEMS);
    }

    const scored = filtered
      .map((i) => {
        const score = Math.max(
          scoreMatch(i.name, query) * 2, // weight name higher
          scoreMatch(i.category, query),
          scoreMatch(i.description, query),
          scoreMatch(i.stores?.name, query)
        );
        return { i, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.i.name.localeCompare(b.i.name))
      .slice(0, MAX_ITEMS);
    return scored.map((x) => x.i);
  }, [items, query, storeFilter, categoryFilter]);

  const hasActiveFilters = storeFilter !== null || categoryFilter !== null;

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const placeholder = hasActiveFilters
    ? `Search within ${[selectedStore?.name, categoryFilter].filter(Boolean).join(" · ")}...`
    : "Search stores, menu items, reviews, categories...";

  // Build target URL when navigating to menu with current filters
  const buildMenuPath = (extra?: { category?: string; store?: string }) => {
    const params = new URLSearchParams();
    if (extra?.category ?? categoryFilter) params.set("category", (extra?.category ?? categoryFilter)!);
    if (extra?.store ?? selectedStore?.slug) params.set("store", (extra?.store ?? selectedStore?.slug)!);
    if (query) params.set("q", query);
    const qs = params.toString();
    return `/menu${qs ? `?${qs}` : ""}`;
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={rawQuery}
        onValueChange={setRawQuery}
        placeholder={placeholder}
      />

      {/* Filter chip bar */}
      <div className="flex items-center gap-1.5 flex-wrap border-b px-3 py-2">
        <Popover open={filterPanel === "store"} onOpenChange={(o) => setFilterPanel(o ? "store" : null)}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant={storeFilter ? "default" : "outline"}
              className="h-7 text-xs gap-1.5"
            >
              <StoreIcon className="h-3 w-3" />
              {selectedStore ? selectedStore.name : "Any store"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <FilterPicker
              placeholder="Filter stores..."
              options={[
                { value: null, label: "Any store" },
                ...(stores ?? []).map((s) => ({ value: s.id, label: s.name, hint: s.store_group ?? undefined })),
              ]}
              selected={storeFilter}
              onSelect={(v) => {
                setStoreFilter(v as string | null);
                setFilterPanel(null);
              }}
            />
          </PopoverContent>
        </Popover>

        <Popover open={filterPanel === "category"} onOpenChange={(o) => setFilterPanel(o ? "category" : null)}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant={categoryFilter ? "default" : "outline"}
              className="h-7 text-xs gap-1.5"
            >
              <Tag className="h-3 w-3" />
              {categoryFilter ?? "Any category"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <FilterPicker
              placeholder="Filter categories..."
              options={[
                { value: null, label: "Any category" },
                ...allCategories.map((c) => ({ value: c, label: c })),
              ]}
              selected={categoryFilter}
              onSelect={(v) => {
                setCategoryFilter(v as string | null);
                setFilterPanel(null);
              }}
            />
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 text-muted-foreground"
            onClick={() => {
              setStoreFilter(null);
              setCategoryFilter(null);
            }}
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {(query || hasActiveFilters) && itemMatches.length > 0 && (
            <button
              type="button"
              onClick={() => go(buildMenuPath())}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <Filter className="h-3 w-3" />
              Open in Menu Browser
            </button>
          )}
        </div>
      </div>

      <CommandList>
        {!query && !hasActiveFilters ? (
          <CommandEmpty>Start typing or pick a store / category to filter.</CommandEmpty>
        ) : storeMatches.length === 0 &&
          itemMatches.length === 0 &&
          categoryMatches.length === 0 &&
          (reviewMatches?.length ?? 0) === 0 ? (
          <CommandEmpty>No results{query ? ` for "${rawQuery}"` : ""}.</CommandEmpty>
        ) : null}

        {storeMatches.length > 0 && (
          <CommandGroup heading="Stores">
            {storeMatches.map((s) => (
              <CommandItem
                key={s.id}
                value={`store-${s.id}-${s.name}`}
                onSelect={() => go(`/stores/${s.slug}`)}
              >
                <StoreIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[s.store_group, s.address].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground tabular-nums">{s.item_count} items</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStoreFilter(s.id);
                    }}
                    className="text-xs text-primary hover:underline"
                    title="Filter results to this store"
                  >
                    Filter
                  </button>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {categoryMatches.length > 0 && (
          <>
            {storeMatches.length > 0 && <CommandSeparator />}
            <CommandGroup heading="Categories">
              {categoryMatches.map((c) => (
                <CommandItem
                  key={c}
                  value={`category-${c}`}
                  onSelect={() => go(buildMenuPath({ category: c }))}
                >
                  <Tag className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="flex-1 truncate">{c}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCategoryFilter(c);
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Filter
                  </button>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {itemMatches.length > 0 && (
          <>
            {(storeMatches.length > 0 || categoryMatches.length > 0) && <CommandSeparator />}
            <CommandGroup heading={`Menu items${hasActiveFilters ? " (filtered)" : ""}`}>
              {itemMatches.map((i) => (
                <CommandItem
                  key={i.id}
                  value={`item-${i.id}-${i.name}`}
                  onSelect={() => go(`/stores/${i.stores?.slug ?? ""}#item-${i.id}`)}
                >
                  <Utensils className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{i.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[i.stores?.name, i.category].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {i.price != null && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatZAR(Number(i.price))}
                      </span>
                    )}
                    {i.deep_link && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {reviewMatches && reviewMatches.length > 0 && (
          <>
            {(storeMatches.length > 0 || categoryMatches.length > 0 || itemMatches.length > 0) && <CommandSeparator />}
            <CommandGroup heading="Reviews">
              {reviewMatches.map((r) => {
                const storeName = stores?.find((s) => s.id === r.store_id)?.name;
                const snippet = (r.text ?? "").replace(/\s+/g, " ").slice(0, 90);
                return (
                  <CommandItem
                    key={r.id}
                    value={`review-${r.id}-${r.reviewer_name ?? ""}-${snippet}`}
                    onSelect={() => go(`/reviews?focus=${encodeURIComponent(r.review_id)}&tab=list`)}
                  >
                    <MessageSquare className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm">{snippet || "(no text)"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[r.reviewer_name, storeName, r.published_at ? new Date(r.published_at).toLocaleDateString() : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    {r.stars != null && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground tabular-nums shrink-0">
                        <Star className="h-3 w-3 fill-current text-primary" />
                        {r.stars}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

interface FilterOption {
  value: string | null;
  label: string;
  hint?: string;
}

function FilterPicker({
  options,
  selected,
  onSelect,
  placeholder,
}: {
  options: FilterOption[];
  selected: string | null;
  onSelect: (v: string | null) => void;
  placeholder: string;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return options.slice(0, 50);
    return options
      .filter((o) => o.label.toLowerCase().includes(ql) || (o.hint ?? "").toLowerCase().includes(ql))
      .slice(0, 50);
  }, [options, q]);

  return (
    <div className="flex flex-col">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="h-9 px-3 text-sm border-b bg-transparent outline-none"
      />
      <div className="max-h-64 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">No matches</div>
        ) : (
          filtered.map((o) => {
            const isSelected = selected === o.value;
            return (
              <button
                key={`${o.value ?? "__any__"}-${o.label}`}
                type="button"
                onClick={() => onSelect(o.value)}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-accent hover:text-accent-foreground transition-colors",
                  isSelected && "bg-accent/60"
                )}
              >
                <Check className={cn("h-3.5 w-3.5", isSelected ? "opacity-100" : "opacity-0")} />
                <span className="flex-1 truncate">{o.label}</span>
                {o.hint && (
                  <Badge variant="outline" className="text-[10px] py-0 h-4">
                    {o.hint}
                  </Badge>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
