import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Search, RefreshCw, LinkIcon, ShieldCheck, X, History } from "lucide-react";
import { runScrape, ScrapeAction } from "@/hooks/useScrape";
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

export function BulkScrapePanel({ stores, items }: Props) {
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
    // group items missing deep_link by store (one scrape per store)
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Bulk scrape (Firecrawl)</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Find missing URLs, refresh metadata and validate links across all stores.
          </p>
        </div>
        <JobLogSheet />
      </CardHeader>
      <CardContent className="space-y-3">
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
      </CardContent>
    </Card>
  );
}

function JobLogSheet() {
  const { data: jobs } = useQuery({
    queryKey: ["scrape-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scrape_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="ghost">
          <History className="h-4 w-4 mr-2" /> Job log
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Recent scrape jobs</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {(!jobs || jobs.length === 0) && (
            <div className="text-sm text-muted-foreground">No jobs yet.</div>
          )}
          {jobs?.map((j: any) => (
            <div key={j.id} className="rounded-md border p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">{j.action}</span>
                <Badge
                  variant={
                    j.status === "success"
                      ? "default"
                      : j.status === "error"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {j.status}
                </Badge>
              </div>
              <div className="text-muted-foreground">
                {j.target_type} · {j.provider} · {formatDistanceToNow(new Date(j.created_at), { addSuffix: true })}
              </div>
              {j.error && <div className="text-destructive">{j.error}</div>}
              {j.result && (
                <pre className="bg-muted p-1.5 rounded text-[10px] overflow-x-auto">
                  {JSON.stringify(j.result, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
