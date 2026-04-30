import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  RefreshCw,
  LinkIcon,
  ShieldCheck,
  X,
  History,
  Download,
  Upload as UploadIcon,
  Database,
  Loader2,
} from "lucide-react";
import { runScrape, ScrapeAction } from "@/hooks/useScrape";
import { logActivity } from "@/lib/activityLog";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

type Store = { id: string; uber_eats_url: string | null };
type Item = { id: string; store_id: string; deep_link: string | null; stores: { uber_eats_url: string | null } };

interface Props {
  stores: Store[];
  items: Item[];
}

type BulkJob = {
  label: string;
  total: number;
  done: number;
  failed: number;
  running: boolean;
};

export function SyncCenter({ stores, items }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" /> Sync Center
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Supabase is the source of truth. Pulls only fill blanks; pushes overwrite Airtable.
          </p>
        </div>
        <SyncLogSheet />
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="scrape">
          <TabsList>
            <TabsTrigger value="scrape">Scrape</TabsTrigger>
            <TabsTrigger value="airtable">Airtable</TabsTrigger>
            <TabsTrigger value="excel">Excel</TabsTrigger>
          </TabsList>

          <TabsContent value="scrape" className="space-y-3 pt-3">
            <ScrapeTab stores={stores} items={items} />
          </TabsContent>
          <TabsContent value="airtable" className="space-y-3 pt-3">
            <AirtableTab />
          </TabsContent>
          <TabsContent value="excel" className="pt-3">
            <ExcelTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ScrapeTab({ stores, items }: Props) {
  const qc = useQueryClient();
  const [job, setJob] = useState<BulkJob | null>(null);
  const cancelRef = useRef(false);

  const run = async (
    label: string,
    targets: Array<{ action: ScrapeAction; payload: { store_id?: string; item_id?: string } }>,
  ) => {
    if (job?.running) return;
    cancelRef.current = false;
    setJob({ label, total: targets.length, done: 0, failed: 0, running: true });
    let done = 0;
    let failed = 0;
    for (const t of targets) {
      if (cancelRef.current) break;
      try {
        await runScrape(t);
      } catch {
        failed++;
      }
      done++;
      setJob({ label, total: targets.length, done, failed, running: true });
    }
    setJob({ label, total: targets.length, done, failed, running: false });
    qc.invalidateQueries({ queryKey: ["stores"] });
    qc.invalidateQueries({ queryKey: ["all-items"] });
    qc.invalidateQueries({ queryKey: ["scrape-jobs"] });
    qc.invalidateQueries({ queryKey: ["sync-runs"] });
    toast.success(`${label}: ${done - failed} succeeded, ${failed} failed`);
  };

  const findMissingStoreUrls = () => {
    const targets = stores
      .filter((s) => !s.uber_eats_url)
      .map((s) => ({ action: "find_store_url" as const, payload: { store_id: s.id } }));
    if (!targets.length) return toast.info("All stores already have a URL");
    run(`Find ${targets.length} missing store URL${targets.length === 1 ? "" : "s"}`, targets);
  };

  const scrapeMissingItemLinks = () => {
    const storeIds = new Set<string>();
    for (const i of items) {
      if (!i.deep_link && i.stores.uber_eats_url) storeIds.add(i.store_id);
    }
    const targets = Array.from(storeIds).map((store_id) => ({
      action: "scrape_item_links" as const,
      payload: { store_id },
    }));
    if (!targets.length) return toast.info("No items missing deep links");
    run(`Scrape item links for ${targets.length} store${targets.length === 1 ? "" : "s"}`, targets);
  };

  const refreshAllMetadata = () => {
    const targets = stores
      .filter((s) => !!s.uber_eats_url)
      .map((s) => ({ action: "scrape_store_metadata" as const, payload: { store_id: s.id } }));
    if (!targets.length) return toast.info("No stores with URLs to refresh");
    run(`Refresh metadata for ${targets.length} stores`, targets);
  };

  const validateAllUrls = () => {
    const targets = stores
      .filter((s) => !!s.uber_eats_url)
      .map((s) => ({ action: "validate_url" as const, payload: { store_id: s.id } }));
    if (!targets.length) return toast.info("No URLs to validate");
    run(`Validate ${targets.length} store URLs`, targets);
  };

  const pct = job && job.total > 0 ? Math.round((job.done / job.total) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={findMissingStoreUrls} disabled={job?.running}>
          <Search className="h-4 w-4 mr-2" /> Find missing store URLs
        </Button>
        <Button size="sm" variant="outline" onClick={scrapeMissingItemLinks} disabled={job?.running}>
          <LinkIcon className="h-4 w-4 mr-2" /> Scrape missing item deep links
        </Button>
        <Button size="sm" variant="outline" onClick={refreshAllMetadata} disabled={job?.running}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh all metadata
        </Button>
        <Button size="sm" variant="outline" onClick={validateAllUrls} disabled={job?.running}>
          <ShieldCheck className="h-4 w-4 mr-2" /> Validate all URLs
        </Button>
      </div>

      {job && (
        <div className="rounded-md border p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{job.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">
                {job.done} / {job.total} {job.failed > 0 && `(${job.failed} failed)`}
              </span>
              {job.running && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={() => {
                    cancelRef.current = true;
                  }}
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Cancel
                </Button>
              )}
            </div>
          </div>
          <Progress value={pct} />
        </div>
      )}
    </div>
  );
}

function AirtableTab() {
  const qc = useQueryClient();
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [lastResult, setLastResult] = useState<{ kind: "pull" | "push"; data: any } | null>(null);

  const { data: lastRuns } = useQuery({
    queryKey: ["sync-runs", "airtable-latest"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sync_runs")
        .select("*")
        .eq("source", "airtable")
        .order("started_at", { ascending: false })
        .limit(2);
      return data ?? [];
    },
  });

  const lastPull = lastRuns?.find((r: any) => r.direction === "pull");
  const lastPush = lastRuns?.find((r: any) => r.direction === "push");

  const handlePull = async () => {
    setPulling(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-airtable", { body: { direction: "pull" } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Pull failed");
      setLastResult({ kind: "pull", data });
      toast.success(`Pull: ${data.stores_filled} filled, ${data.stores_skipped_supabase_wins} kept`);
      void logActivity({
        action: "sync.airtable.pull",
        entity_type: "sync",
        entity_label: "Airtable → Supabase",
        details: {
          stores_filled: data.stores_filled,
          stores_skipped: data.stores_skipped_supabase_wins,
          promotions_upserted: data.promotions_upserted,
          promotions_removed: data.promotions_removed,
        },
      });
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(`Pull failed: ${e.message}`);
      void logActivity({ action: "sync.airtable.pull.failed", entity_type: "sync", details: { error: e.message } });
    } finally {
      setPulling(false);
    }
  };

  const handlePush = async () => {
    setPushing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-airtable", { body: { direction: "push" } });
      if (error) throw error;
      setLastResult({ kind: "push", data });
      if (data?.ok) {
        toast.success(`Push: ${data.stores_pushed} updated in Airtable`);
        void logActivity({
          action: "sync.airtable.push",
          entity_type: "sync",
          entity_label: "Supabase → Airtable",
          details: { stores_pushed: data.stores_pushed },
        });
      } else {
        toast.warning(data?.error ?? "Push completed with errors");
        void logActivity({ action: "sync.airtable.push.partial", entity_type: "sync", details: { error: data?.error } });
      }
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(`Push failed: ${e.message}`);
      void logActivity({ action: "sync.airtable.push.failed", entity_type: "sync", details: { error: e.message } });
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={handlePull} disabled={pulling || pushing}>
          {pulling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Pull from Airtable
        </Button>
        <Button size="sm" variant="outline" onClick={handlePush} disabled={pulling || pushing}>
          {pushing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UploadIcon className="h-4 w-4 mr-2" />}
          Push to Airtable
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        <RunSummary label="Last pull" run={lastPull} />
        <RunSummary label="Last push" run={lastPush} />
      </div>

      {lastResult && (
        <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
          <div className="font-medium capitalize">{lastResult.kind} result</div>
          {lastResult.kind === "pull" ? (
            <ul className="text-muted-foreground space-y-0.5">
              <li>{lastResult.data.stores_filled} stores filled (were blank)</li>
              <li>{lastResult.data.stores_skipped_supabase_wins} kept (Supabase had a value)</li>
              <li>{lastResult.data.stores_unmatched?.length ?? 0} stores in Airtable not matched in Supabase</li>
              <li>{lastResult.data.promotions_upserted} promotions saved · {lastResult.data.promotions_removed} removed</li>
            </ul>
          ) : (
            <ul className="text-muted-foreground space-y-0.5">
              <li>{lastResult.data.stores_pushed} stores updated in Airtable</li>
              <li>{lastResult.data.stores_unchanged} unchanged</li>
              <li>{lastResult.data.stores_not_found_in_airtable?.length ?? 0} not found in Airtable</li>
              {lastResult.data.push_errors?.length > 0 && (
                <li className="text-destructive">
                  {lastResult.data.push_errors.length} write errors — likely the URL field is a lookup. First: {lastResult.data.push_errors[0]?.error?.slice(0, 200)}
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function RunSummary({ label, run }: { label: string; run: any }) {
  if (!run) {
    return (
      <div className="rounded-md border p-2">
        <div className="text-muted-foreground">{label}</div>
        <div className="font-medium">Never</div>
      </div>
    );
  }
  return (
    <div className="rounded-md border p-2">
      <div className="text-muted-foreground flex items-center gap-2">
        {label}
        <Badge variant={run.status === "success" ? "default" : "destructive"} className="text-[10px]">
          {run.status}
        </Badge>
      </div>
      <div className="font-medium">{formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}</div>
    </div>
  );
}

function ExcelTab() {
  return (
    <div className="text-sm space-y-2">
      <p className="text-muted-foreground">
        Excel uploads now <strong>merge</strong> with Supabase — existing values are kept, blanks get filled.
      </p>
      <Button asChild size="sm" variant="outline">
        <Link to="/upload">
          <UploadIcon className="h-4 w-4 mr-2" /> Open uploader
        </Link>
      </Button>
    </div>
  );
}

function SyncLogSheet() {
  const [open, setOpen] = useState(false);

  const { data: scrapeJobs } = useQuery({
    queryKey: ["scrape-jobs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("scrape_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });

  const { data: syncRuns } = useQuery({
    queryKey: ["sync-runs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sync_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });

  // merge + sort
  const merged = [
    ...(syncRuns ?? []).map((r: any) => ({ kind: "sync", at: r.started_at, row: r })),
    ...(scrapeJobs ?? []).map((j: any) => ({ kind: "scrape", at: j.created_at, row: j })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="ghost">
          <History className="h-4 w-4 mr-2" /> Sync log
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Recent sync activity</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {merged.length === 0 && <div className="text-sm text-muted-foreground">No activity yet.</div>}
          {merged.map(({ kind, row }) => (
            <div key={`${kind}-${row.id}`} className="rounded-md border p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {kind === "scrape" ? row.action : `${row.direction} · ${row.source}`}
                </span>
                <Badge
                  variant={
                    row.status === "success"
                      ? "default"
                      : row.status === "error"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {row.status}
                </Badge>
              </div>
              <div className="text-muted-foreground">
                {kind === "scrape"
                  ? `${row.target_type} · ${row.provider}`
                  : "manual sync"}
                {" · "}
                {formatDistanceToNow(new Date(kind === "scrape" ? row.created_at : row.started_at), {
                  addSuffix: true,
                })}
              </div>
              {row.error && <div className="text-destructive">{row.error}</div>}
              {(row.result || row.summary) && (
                <pre className="bg-muted p-1.5 rounded text-[10px] overflow-x-auto">
                  {JSON.stringify(row.result ?? row.summary, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
