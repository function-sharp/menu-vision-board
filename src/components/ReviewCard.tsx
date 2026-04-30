import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ExternalLink, MessageSquareReply, ThumbsUp } from "lucide-react";
import { Stars } from "./StarDistribution";
import type { GoogleReview } from "@/hooks/useReviews";
import { decodeText } from "@/lib/format";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ReviewCard({ review, storeName }: { review: GoogleReview; storeName?: string | null }) {
  const [openResp, setOpenResp] = useState(false);
  const subRatings = [
    { label: "Food", value: review.detailed_food },
    { label: "Service", value: review.detailed_service },
    { label: "Atmosphere", value: review.detailed_atmosphere },
  ].filter((r) => r.value != null);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={review.reviewer_photo_url ?? undefined} alt={review.reviewer_name ?? "Reviewer"} />
          <AvatarFallback>{initials(review.reviewer_name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{review.reviewer_name ?? "Anonymous"}</span>
            {review.is_local_guide && (
              <Badge variant="secondary" className="h-5 text-[10px]">Local Guide</Badge>
            )}
            {review.reviewer_review_count != null && (
              <span className="text-xs text-muted-foreground">{review.reviewer_review_count} reviews</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            <Stars value={review.stars ?? 0} />
            <span>·</span>
            <span>{formatDate(review.published_at)}</span>
            {storeName && (
              <>
                <span>·</span>
                <span className="truncate">{storeName}</span>
              </>
            )}
          </div>
        </div>
        {review.review_url && (
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <a href={review.review_url} target="_blank" rel="noopener noreferrer" aria-label="Open on Google">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
      </div>

      {review.text && (
        <p className="text-sm whitespace-pre-line text-foreground/90">{decodeText(review.text)}</p>
      )}

      {subRatings.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs">
          {subRatings.map((r) => (
            <div key={r.label} className="flex items-center gap-1.5">
              <span className="text-muted-foreground">{r.label}:</span>
              <Stars value={r.value!} size={12} />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {(review.likes_count ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" /> {review.likes_count}
          </span>
        )}
      </div>

      {review.response_text && (
        <Collapsible open={openResp} onOpenChange={setOpenResp}>
          <CollapsibleTrigger asChild>
            <button className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              <MessageSquareReply className="h-3.5 w-3.5" />
              Owner response
              <ChevronDown className={`h-3 w-3 transition-transform ${openResp ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="rounded-md border-l-2 border-primary bg-muted/40 p-3 text-sm whitespace-pre-line text-muted-foreground">
              <div className="text-[10px] uppercase tracking-wide mb-1 text-muted-foreground/80">
                Replied {formatDate(review.response_at)}
              </div>
              {decodeText(review.response_text)}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
