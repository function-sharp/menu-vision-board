import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLog";

export type ScrapeAction =
  | "find_store_url"
  | "scrape_store_metadata"
  | "scrape_item_links"
  | "validate_url";

export type ScrapeProvider = "firecrawl" | "apify";

export interface ScrapeArgs {
  action: ScrapeAction;
  payload: { store_id?: string; item_id?: string };
  provider?: ScrapeProvider;
}

export interface ScrapeResult {
  ok?: boolean;
  url?: string;
  matched?: number;
  total?: number;
  applied?: Record<string, unknown>;
  status?: number | null;
  name_match?: boolean | null;
  error?: string;
}

export async function runScrape(args: ScrapeArgs): Promise<ScrapeResult> {
  const { data, error } = await supabase.functions.invoke("scrape-uber-eats", {
    body: args,
  });
  if (error) throw new Error(error.message ?? "Scrape failed");
  if (data?.error && data?.ok === false) throw new Error(data.error);
  if (data?.error && data?.ok !== true) throw new Error(data.error);
  return data as ScrapeResult;
}

export function useScrape() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runScrape,
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["stores"] });
      qc.invalidateQueries({ queryKey: ["all-items"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["scrape-jobs"] });
      const labels: Record<ScrapeAction, string> = {
        find_store_url: "Found Uber Eats URL",
        scrape_store_metadata: "Refreshed metadata",
        scrape_item_links: "Matched item links",
        validate_url: "URL validated",
      };
      toast.success(labels[vars.action]);
      void logActivity({
        action: `scrape.${vars.action}`,
        entity_type: vars.payload.item_id ? "menu_item" : "store",
        entity_id: vars.payload.item_id ?? vars.payload.store_id ?? null,
        details: {
          provider: vars.provider ?? "firecrawl",
          url: data?.url,
          matched: data?.matched,
          total: data?.total,
        },
      });
    },
    onError: (e: Error, vars) => {
      toast.error(e.message || "Scrape failed");
      void logActivity({
        action: `scrape.${vars.action}.failed`,
        entity_type: vars.payload.item_id ? "menu_item" : "store",
        entity_id: vars.payload.item_id ?? vars.payload.store_id ?? null,
        details: { error: e.message, provider: vars.provider ?? "firecrawl" },
      });
    },
  });
}

