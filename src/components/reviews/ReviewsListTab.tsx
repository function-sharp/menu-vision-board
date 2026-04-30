import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGooglePlaces, useReviews, useReviewStats, type ReviewFilters } from "@/hooks/useReviews";
import { useStores } from "@/hooks/useDashboardData";
import { ReviewCard } from "@/components/ReviewCard";
import { Stars, StarDistribution } from "@/components/StarDistribution";
import { Search, Star, MessageSquare, ReplyAll, CalendarClock, Download } from "lucide-react";
import { toast } from "sonner";
import { useScopedStoreIds, type ReviewScope, defaultScope } from "./ReviewFiltersBar";

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

export function ReviewsListTab({ initialStoreId, scope = defaultScope }: { initialStoreId?: string | null; scope?: ReviewScope } = {}) {
  const { data: stores } = useStores();
  const { data: places } = useGooglePlaces();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusReviewId = searchParams.get("focus");
  const { storeId: scopedStoreId, storeIds: scopedStoreIds } = useScopedStoreIds(scope);

  const [storeId, setStoreId] = useState<string | "all">(initialStoreId ?? "all");
  const [stars, setStars] = useState<string>("all");
  const [responseFilter, setResponseFilter] = useState<"all" | "with" | "without">("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<NonNullable<ReviewFilters["sortBy"]>>("newest");
  const [pageSize, setPageSize] = useState<number>(100);

  // Local "store" select narrows further inside the page-level scope.
  const effectiveStoreId = storeId !== "all" ? storeId : (scopedStoreId ?? null);
  const effectiveStoreIds = effectiveStoreId ? null : (scopedStoreIds ?? null);

  const filters: ReviewFilters = {
    storeId: effectiveStoreId,
    storeIds: effectiveStoreIds,
    stars: stars === "all" ? null : Number(stars),
    hasResponse: responseFilter === "with" ? true : false,
    search,
    sortBy,
    limit: pageSize,
  };
  const { data: reviews, isLoading } = useReviews(filters);
  const { data: stats } = useReviewStats(effectiveStoreId, effectiveStoreIds);

  const storeName = useMemo(() => {
    const map = new Map<string, string>();
    stores?.forEach((s) => map.set(s.id, s.name));
    return (id: string | null) => (id ? map.get(id) ?? null : null);
  }, [stores]);

  const filteredReviews = useMemo(() => {
    if (!reviews) return [];
    if (responseFilter === "without") return reviews.filter((r) => !r.response_text);
    return reviews;
  }, [reviews, responseFilter]);

  // Scroll-to-focus highlight
  const focusedRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!focusReviewId || isLoading) return;
    if (focusedRef.current) {
      focusedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      const el = focusedRef.current;
      el.classList.add("ring-2", "ring-primary", "ring-offset-2");
      const t = setTimeout(() => el.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 2500);
      return () => clearTimeout(t);
    }
  }, [focusReviewId, isLoading, filteredReviews.length]);

  const handleExport = () => {
    if (!filteredReviews.length) {
      toast.info("Nothing to export");
      return;
    }
    const headers = ["published_at", "store", "stars", "reviewer", "text", "response", "likes", "url"];
    const lines = [headers.join(",")];
    for (const r of filteredReviews) {
      lines.push(
        [
          r.published_at ?? "",
          storeName(r.store_id) ?? "",
          r.stars ?? "",
          r.reviewer_name ?? "",
          r.text ?? "",
          r.response_text ?? "",
          r.likes_count ?? 0,
          r.review_url ?? "",
        ].map(csvEscape).join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `google-reviews-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFocus = () => {
    if (focusReviewId) {
      const next = new URLSearchParams(searchParams);
      next.delete("focus");
      setSearchParams(next, { replace: true });
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={<MessageSquare className="h-4 w-4" />} label="Total reviews" value={stats ? stats.total.toLocaleString() : "—"} />
        <KpiCard
          icon={<Star className="h-4 w-4" />}
          label="Average rating"
          value={stats ? stats.avgStars.toFixed(2) : "—"}
          extra={stats ? <Stars value={stats.avgStars} size={12} /> : null}
        />
        <KpiCard icon={<ReplyAll className="h-4 w-4" />} label="Owner response" value={stats ? `${Math.round(stats.responseRate * 100)}%` : "—"} />
        <KpiCard icon={<CalendarClock className="h-4 w-4" />} label="Last 30 days" value={stats ? stats.last30.toLocaleString() : "—"} />
      </div>

      {/* Distribution + sub-ratings */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Rating distribution</CardTitle></CardHeader>
          <CardContent>{stats ? <StarDistribution distribution={stats.distribution} /> : <Skeleton className="h-32" />}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Detailed averages</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stats ? (
              <>
                <SubAvg label="Food" value={stats.avgFood} />
                <SubAvg label="Service" value={stats.avgService} />
                <SubAvg label="Atmosphere" value={stats.avgAtmosphere} />
              </>
            ) : (
              <Skeleton className="h-24" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search reviews, reviewer name…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={storeId} onValueChange={(v) => setStoreId(v as any)}>
              <SelectTrigger><SelectValue placeholder="Store" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stores</SelectItem>
                {(stores ?? [])
                  .filter((s) => places?.some((p) => p.store_id === s.id))
                  .filter((s) => {
                    if (scopedStoreId) return s.id === scopedStoreId;
                    if (scopedStoreIds && scopedStoreIds.length > 0) return scopedStoreIds.includes(s.id);
                    return true;
                  })
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={stars} onValueChange={setStars}>
              <SelectTrigger><SelectValue placeholder="Stars" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stars</SelectItem>
                {[5, 4, 3, 2, 1].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} star{n > 1 ? "s" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="highest">Highest rated</SelectItem>
                <SelectItem value="lowest">Lowest rated</SelectItem>
                <SelectItem value="likes">Most liked</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[50, 100, 200, 500].map((n) => <SelectItem key={n} value={String(n)}>{n} per page</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Owner response:</span>
            {(["all", "with", "without"] as const).map((opt) => (
              <Badge
                key={opt}
                variant={responseFilter === opt ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setResponseFilter(opt)}
              >
                {opt === "all" ? "All" : opt === "with" ? "With reply" : "No reply"}
              </Badge>
            ))}
            {focusReviewId && (
              <Badge variant="secondary" className="cursor-pointer" onClick={clearFocus}>
                Focused review · clear ✕
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="ml-auto" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <span className="text-xs text-muted-foreground">Showing {filteredReviews.length}</span>
          </div>
        </CardContent>
      </Card>

      {/* Reviews list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : filteredReviews.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No reviews match your filters.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filteredReviews.map((r) => {
            const isFocused = focusReviewId && r.review_id === focusReviewId;
            return (
              <div key={r.id} ref={isFocused ? focusedRef : undefined} className="rounded-lg transition-all">
                <ReviewCard review={r} storeName={storeName(r.store_id)} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, extra }: { icon: React.ReactNode; label: string; value: string; extra?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-wide">
          <span>{label}</span>
          {icon}
        </div>
        <div className="text-2xl font-bold mt-2">{value}</div>
        {extra && <div className="mt-1">{extra}</div>}
      </CardContent>
    </Card>
  );
}

function SubAvg({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Stars value={value} size={12} />
        <span className="text-sm font-medium tabular-nums w-10 text-right">{value ? value.toFixed(2) : "—"}</span>
      </div>
    </div>
  );
}
