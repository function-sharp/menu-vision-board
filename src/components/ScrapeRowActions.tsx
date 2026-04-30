import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Search, RefreshCw, ShieldCheck, LinkIcon } from "lucide-react";
import { useScrape, ScrapeAction } from "@/hooks/useScrape";

interface IconBtnProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
}
function IconBtn({ label, icon, onClick, loading, disabled }: IconBtnProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={onClick}
            disabled={loading || disabled}
            aria-label={label}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function StoreScrapeActions({
  storeId,
  hasUrl,
}: {
  storeId: string;
  hasUrl: boolean;
}) {
  const scrape = useScrape();
  const isPending = (action: ScrapeAction) =>
    scrape.isPending &&
    scrape.variables?.action === action &&
    scrape.variables?.payload?.store_id === storeId;

  return (
    <div className="flex items-center gap-0.5">
      <IconBtn
        label="Find Uber Eats URL"
        icon={<Search className="h-3.5 w-3.5" />}
        loading={isPending("find_store_url")}
        onClick={() => scrape.mutate({ action: "find_store_url", payload: { store_id: storeId } })}
      />
      <IconBtn
        label="Refresh metadata"
        icon={<RefreshCw className="h-3.5 w-3.5" />}
        loading={isPending("scrape_store_metadata")}
        disabled={!hasUrl}
        onClick={() =>
          scrape.mutate({ action: "scrape_store_metadata", payload: { store_id: storeId } })
        }
      />
      <IconBtn
        label="Scrape item deep links"
        icon={<LinkIcon className="h-3.5 w-3.5" />}
        loading={isPending("scrape_item_links")}
        disabled={!hasUrl}
        onClick={() =>
          scrape.mutate({ action: "scrape_item_links", payload: { store_id: storeId } })
        }
      />
      <IconBtn
        label="Validate URL"
        icon={<ShieldCheck className="h-3.5 w-3.5" />}
        loading={isPending("validate_url")}
        disabled={!hasUrl}
        onClick={() => scrape.mutate({ action: "validate_url", payload: { store_id: storeId } })}
      />
    </div>
  );
}

export function ItemScrapeActions({
  itemId,
  storeId,
  hasItemLink,
  hasStoreUrl,
}: {
  itemId: string;
  storeId: string;
  hasItemLink: boolean;
  hasStoreUrl: boolean;
}) {
  const scrape = useScrape();
  const isPending = (action: ScrapeAction) =>
    scrape.isPending &&
    scrape.variables?.action === action &&
    (scrape.variables?.payload?.item_id === itemId ||
      (action === "scrape_item_links" && scrape.variables?.payload?.store_id === storeId));

  return (
    <div className="flex items-center gap-0.5">
      <IconBtn
        label="Find item deep link (scrapes parent store)"
        icon={<LinkIcon className="h-3.5 w-3.5" />}
        loading={isPending("scrape_item_links")}
        disabled={!hasStoreUrl}
        onClick={() =>
          scrape.mutate({ action: "scrape_item_links", payload: { store_id: storeId } })
        }
      />
      <IconBtn
        label="Validate item link"
        icon={<ShieldCheck className="h-3.5 w-3.5" />}
        loading={isPending("validate_url")}
        disabled={!hasItemLink}
        onClick={() => scrape.mutate({ action: "validate_url", payload: { item_id: itemId } })}
      />
    </div>
  );
}
