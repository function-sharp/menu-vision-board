import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useGooglePlaces, useSyncReviews } from "@/hooks/useReviews";
import { MessageSquare, RefreshCw, BarChart3, Store, ListFilter, Sparkles, Link2 } from "lucide-react";
import { OverviewTab } from "@/components/reviews/OverviewTab";
import { StoresTab } from "@/components/reviews/StoresTab";
import { ReviewsListTab } from "@/components/reviews/ReviewsListTab";
import { InsightsTab } from "@/components/reviews/InsightsTab";
import { ManageLinksTab } from "@/components/reviews/ManageLinksTab";
import { ReviewFiltersBar, defaultScope, type ReviewScope } from "@/components/reviews/ReviewFiltersBar";

export default function Reviews() {
  const { data: places } = useGooglePlaces();
  const sync = useSyncReviews();
  const [searchParams, setSearchParams] = useSearchParams();
  const storeParam = searchParams.get("store");
  const [scope, setScope] = useState<ReviewScope>(
    storeParam ? { ...defaultScope, storeId: storeParam } : defaultScope,
  );

  // Auto-jump to "list" tab when a focus param is present (from Global Search)
  const initialTab = searchParams.get("tab") ?? (searchParams.get("focus") ? "list" : "overview");

  const lastSync = useMemo(() => {
    if (!places || !places.length) return null;
    const dates = places.map((p) => p.last_synced_at).filter(Boolean) as string[];
    if (!dates.length) return null;
    return new Date(Math.max(...dates.map((d) => new Date(d).getTime())));
  }, [places]);

  const setTab = (val: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", val);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6" /> Customer Reviews
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Google Maps reviews ingested from Apify
            {lastSync && <> · last synced {lastSync.toLocaleString()}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${sync.isPending ? "animate-spin" : ""}`} />
            {sync.isPending ? "Syncing..." : "Sync from Google"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card/50 p-3">
        <ReviewFiltersBar scope={scope} onChange={setScope} />
      </div>

      <Tabs value={initialTab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview"><BarChart3 className="h-3.5 w-3.5 mr-1.5" /> Overview</TabsTrigger>
          <TabsTrigger value="stores"><Store className="h-3.5 w-3.5 mr-1.5" /> Stores</TabsTrigger>
          <TabsTrigger value="list"><ListFilter className="h-3.5 w-3.5 mr-1.5" /> Reviews</TabsTrigger>
          <TabsTrigger value="insights"><Sparkles className="h-3.5 w-3.5 mr-1.5" /> AI Insights</TabsTrigger>
          <TabsTrigger value="links"><Link2 className="h-3.5 w-3.5 mr-1.5" /> Manage Links</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab scope={scope} /></TabsContent>
        <TabsContent value="stores"><StoresTab scope={scope} /></TabsContent>
        <TabsContent value="list"><ReviewsListTab scope={scope} /></TabsContent>
        <TabsContent value="insights"><InsightsTab scope={scope} /></TabsContent>
        <TabsContent value="links"><ManageLinksTab /></TabsContent>
      </Tabs>
    </div>
  );
}
