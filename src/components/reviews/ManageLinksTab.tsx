import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGooglePlaces, useUpdatePlaceStore } from "@/hooks/useReviews";
import { useStores } from "@/hooks/useDashboardData";
import { Stars } from "@/components/StarDistribution";
import { ExternalLink, Link2Off, AlertTriangle } from "lucide-react";

export function ManageLinksTab() {
  const { data: places, isLoading } = useGooglePlaces();
  const { data: stores } = useStores();
  const update = useUpdatePlaceStore();
  const [showOnlyUnlinked, setShowOnlyUnlinked] = useState(false);

  const storeMap = useMemo(() => new Map((stores ?? []).map((s) => [s.id, s.name])), [stores]);

  const rows = useMemo(() => {
    let r = places ?? [];
    if (showOnlyUnlinked) r = r.filter((p) => !p.store_id);
    return [...r].sort((a, b) => a.title.localeCompare(b.title));
  }, [places, showOnlyUnlinked]);

  const unlinkedCount = (places ?? []).filter((p) => !p.store_id).length;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <strong>{places?.length ?? 0}</strong> Google places synced.{" "}
            {unlinkedCount > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> {unlinkedCount} not linked to an internal store
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400">All linked ✓</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={showOnlyUnlinked ? "default" : "outline"}
              onClick={() => setShowOnlyUnlinked((v) => !v)}
            >
              <Link2Off className="h-3.5 w-3.5 mr-1.5" />
              {showOnlyUnlinked ? "Showing unlinked" : "Show only unlinked"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Google place</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="text-right">Google rating</TableHead>
                  <TableHead className="text-right">Reviews on Google</TableHead>
                  <TableHead>Linked store</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                      No places to show.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((p) => (
                  <TableRow key={p.place_id}>
                    <TableCell>
                      <div className="font-medium text-sm">{p.title}</div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate max-w-xs">{p.place_id}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.city ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {p.total_score != null ? (
                        <div className="inline-flex items-center gap-1.5">
                          <Stars value={p.total_score} size={11} />
                          <span className="tabular-nums">{Number(p.total_score).toFixed(1)}</span>
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.reviews_count != null ? p.reviews_count.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="min-w-[260px]">
                      <Select
                        value={p.store_id ?? "__none"}
                        onValueChange={(v) => update.mutate({ placeId: p.place_id, storeId: v === "__none" ? null : v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pick a store…">
                            {p.store_id ? (
                              <span>{storeMap.get(p.store_id) ?? "Unknown store"}</span>
                            ) : (
                              <span className="text-muted-foreground">Not linked</span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">— Not linked —</SelectItem>
                          {(stores ?? []).map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                        {!p.store_id && <Badge variant="outline" className="text-[10px] mr-1">Unlinked</Badge>}
                        {p.url && (
                          <Button asChild variant="ghost" size="sm">
                            <a href={p.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Changing the linked store updates all of that place's reviews automatically.
        </div>
      </CardContent>
    </Card>
  );
}
