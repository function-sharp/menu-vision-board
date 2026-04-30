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
import { useStores, useAllItems } from "@/hooks/useDashboardData";
import { useReviewSearch } from "@/hooks/useReviews";
import { Store as StoreIcon, Utensils, Tag, ExternalLink, MessageSquare, Star } from "lucide-react";
import { formatZAR } from "@/lib/format";

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { data: stores } = useStores();
  const { data: items } = useAllItems();
  const { data: reviewMatches } = useReviewSearch(query, open);

  // Reset query when dialog closes
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const q = query.trim().toLowerCase();

  const storeMatches = useMemo(() => {
    if (!stores || q.length < 1) return [];
    return stores
      .filter((s) => {
        return (
          s.name.toLowerCase().includes(q) ||
          (s.store_group ?? "").toLowerCase().includes(q) ||
          (s.cuisine ?? "").toLowerCase().includes(q) ||
          (s.address ?? "").toLowerCase().includes(q) ||
          (s.slug ?? "").toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [stores, q]);

  const itemMatches = useMemo(() => {
    if (!items || q.length < 1) return [];
    return items
      .filter((i) => {
        return (
          i.name.toLowerCase().includes(q) ||
          (i.id ?? "").toLowerCase().startsWith(q) ||
          (i.category ?? "").toLowerCase().includes(q) ||
          (i.description ?? "").toLowerCase().includes(q) ||
          (i.stores?.name ?? "").toLowerCase().includes(q)
        );
      })
      .slice(0, 12);
  }, [items, q]);

  const categoryMatches = useMemo(() => {
    if (!items || q.length < 1) return [];
    const set = new Set<string>();
    for (const i of items) {
      const c = i.category;
      if (c && c.toLowerCase().includes(q)) set.add(c);
    }
    return Array.from(set).slice(0, 6);
  }, [items, q]);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search stores, menu items, reviews, SKUs, categories..."
      />
      <CommandList>
        {q.length === 0 ? (
          <CommandEmpty>Start typing to search stores, menu items, and reviews.</CommandEmpty>
        ) : storeMatches.length === 0 && itemMatches.length === 0 && categoryMatches.length === 0 && (reviewMatches?.length ?? 0) === 0 ? (
          <CommandEmpty>No results for "{query}".</CommandEmpty>
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
                <span className="text-xs text-muted-foreground tabular-nums">{s.item_count} items</span>
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
                  onSelect={() => go(`/menu?category=${encodeURIComponent(c)}`)}
                >
                  <Tag className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="flex-1 truncate">{c}</span>
                  <span className="text-xs text-muted-foreground">Browse menu</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {itemMatches.length > 0 && (
          <>
            {(storeMatches.length > 0 || categoryMatches.length > 0) && <CommandSeparator />}
            <CommandGroup heading="Menu items">
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
                      <span className="text-xs tabular-nums text-muted-foreground">{formatZAR(Number(i.price))}</span>
                    )}
                    {i.deep_link && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
