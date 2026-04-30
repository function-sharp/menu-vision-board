import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGooglePlaces } from "@/hooks/useReviews";
import { useStores } from "@/hooks/useDashboardData";
import { Filter, X, MapPin, Building2, Store as StoreIcon } from "lucide-react";

export type ReviewScope = {
  group: string; // "all" or group name
  city: string; // "all" or city name
  storeId: string; // "all" or uuid
};

export const defaultScope: ReviewScope = { group: "all", city: "all", storeId: "all" };

/**
 * Resolves the final list of store IDs that match the active filters.
 * If `storeId` is set explicitly, it wins.
 * If `group`/`city` are set, returns the intersection of stores matching both.
 * Returns `null` when no narrowing should happen ("all everything").
 */
export function useScopedStoreIds(scope: ReviewScope): {
  storeId: string | null;
  storeIds: string[] | null;
} {
  const { data: stores } = useStores();
  const { data: places } = useGooglePlaces();

  return useMemo(() => {
    if (scope.storeId !== "all") return { storeId: scope.storeId, storeIds: null };
    const noGroup = scope.group === "all";
    const noCity = scope.city === "all";
    if (noGroup && noCity) return { storeId: null, storeIds: null };
    const placeCityByStore = new Map<string, string | null>();
    (places ?? []).forEach((p) => {
      if (p.store_id) placeCityByStore.set(p.store_id, p.city ?? null);
    });
    const ids = (stores ?? [])
      .filter((s) => (noGroup || s.store_group === scope.group))
      .filter((s) => (noCity || placeCityByStore.get(s.id) === scope.city))
      .map((s) => s.id);
    return { storeId: null, storeIds: ids };
  }, [scope, stores, places]);
}

export function ReviewFiltersBar({
  scope,
  onChange,
  showStore = true,
  className,
}: {
  scope: ReviewScope;
  onChange: (next: ReviewScope) => void;
  showStore?: boolean;
  className?: string;
}) {
  const { data: stores } = useStores();
  const { data: places } = useGooglePlaces();

  const groups = useMemo(
    () => Array.from(new Set((stores ?? []).map((s) => s.store_group).filter(Boolean))) as string[],
    [stores],
  );
  const cities = useMemo(
    () => Array.from(new Set((places ?? []).map((p) => p.city).filter(Boolean))).sort() as string[],
    [places],
  );

  const linkedStores = useMemo(
    () => (stores ?? []).filter((s) => places?.some((p) => p.store_id === s.id)),
    [stores, places],
  );

  // After the scope changes, narrow the visible store list (e.g. only show stores in the chosen city)
  const visibleStores = useMemo(() => {
    const placeCityByStore = new Map<string, string | null>();
    (places ?? []).forEach((p) => {
      if (p.store_id) placeCityByStore.set(p.store_id, p.city ?? null);
    });
    return linkedStores
      .filter((s) => scope.group === "all" || s.store_group === scope.group)
      .filter((s) => scope.city === "all" || placeCityByStore.get(s.id) === scope.city);
  }, [linkedStores, places, scope.group, scope.city]);

  const isFiltered = scope.group !== "all" || scope.city !== "all" || scope.storeId !== "all";

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
        <Filter className="h-3.5 w-3.5" />
        Scope
      </div>

      <Select
        value={scope.group}
        onValueChange={(v) => onChange({ ...scope, group: v, storeId: "all" })}
      >
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
          <SelectValue placeholder="Group" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All groups</SelectItem>
          {groups.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select
        value={scope.city}
        onValueChange={(v) => onChange({ ...scope, city: v, storeId: "all" })}
      >
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <MapPin className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
          <SelectValue placeholder="City" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All cities</SelectItem>
          {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>

      {showStore && (
        <Select value={scope.storeId} onValueChange={(v) => onChange({ ...scope, storeId: v })}>
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <StoreIcon className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Store" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stores</SelectItem>
            {visibleStores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {isFiltered && (
        <>
          <div className="flex items-center gap-1.5 ml-1">
            {scope.group !== "all" && <Badge variant="secondary" className="text-[10px]">{scope.group}</Badge>}
            {scope.city !== "all" && <Badge variant="secondary" className="text-[10px]">{scope.city}</Badge>}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            onClick={() => onChange(defaultScope)}
          >
            <X className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        </>
      )}
    </div>
  );
}
