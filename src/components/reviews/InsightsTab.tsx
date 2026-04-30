import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useGenerateInsight, useReviewInsight, type ReviewPeriod } from "@/hooks/useReviews";
import { useGooglePlaces } from "@/hooks/useReviews";
import { useStores } from "@/hooks/useDashboardData";
import { Sparkles, ThumbsUp, ThumbsDown, ListChecks, RefreshCw, ExternalLink } from "lucide-react";

const PERIODS: { value: ReviewPeriod; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
  { value: "all", label: "All time" },
];

import { useScopedStoreIds, type ReviewScope, defaultScope } from "./ReviewFiltersBar";

export function InsightsTab({ scope = defaultScope }: { scope?: ReviewScope }) {
  const { data: stores } = useStores();
  const { data: places } = useGooglePlaces();
  const navigate = useNavigate();
  const { storeId: scopedStoreId, storeIds: scopedStoreIds } = useScopedStoreIds(scope);

  const [storeId, setStoreId] = useState<string | "all">("all");
  const [period, setPeriod] = useState<ReviewPeriod>("90d");
  // Insights work on a single store (or "all"). When the page scope narrows to
  // exactly one store, default the store dropdown to it; otherwise let the user pick.
  const sid = storeId === "all" ? (scopedStoreId ?? null) : storeId;

  const { data: cached, isLoading: loadingCached } = useReviewInsight(sid, period);
  const generate = useGenerateInsight();

  const insight = generate.data?.insight ?? cached;

  const linkedStores = (stores ?? [])
    .filter((s) => places?.some((p) => p.store_id === s.id))
    .filter((s) => {
      if (scopedStoreId) return s.id === scopedStoreId;
      if (scopedStoreIds && scopedStoreIds.length > 0) return scopedStoreIds.includes(s.id);
      return true;
    });

  const openReview = (reviewId?: string) => {
    if (!reviewId) return;
    navigate(`/reviews?focus=${encodeURIComponent(reviewId)}&tab=list`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              AI insights from customer reviews
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <Select value={storeId} onValueChange={(v) => setStoreId(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stores</SelectItem>
                {linkedStores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={(v) => setPeriod(v as ReviewPeriod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              onClick={() => generate.mutate({ storeId: sid, period, force: true })}
              disabled={generate.isPending}
            >
              {generate.isPending ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Generating…</>
              ) : insight ? (
                <><RefreshCw className="h-4 w-4 mr-2" /> Regenerate</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Generate insights</>
              )}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Insights are cached for 24 hours per store + period to keep token use low. Click <strong>Regenerate</strong> to force a refresh.
          </div>
        </CardContent>
      </Card>

      {loadingCached && !insight ? (
        <Skeleton className="h-96" />
      ) : !insight ? (
        <Card>
          <CardContent className="p-12 text-center space-y-2">
            <Sparkles className="h-8 w-8 text-muted-foreground mx-auto" />
            <div className="font-medium">No insights yet</div>
            <div className="text-sm text-muted-foreground">Click <em>Generate insights</em> above to analyse the latest reviews.</div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Header summary */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm font-medium">Executive summary</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Badge variant="outline">Sample {insight.sample_size ?? "?"} reviews</Badge>
                  <span>Generated {new Date(insight.generated_at).toLocaleString()}</span>
                </div>
              </div>
              <p className="text-sm leading-relaxed">{insight.summary}</p>
            </CardContent>
          </Card>

          {/* Action items */}
          {insight.action_items && insight.action_items.length > 0 && (
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ListChecks className="h-4 w-4 text-primary" /> Recommended actions
                </div>
                <ul className="space-y-2">
                  {insight.action_items.map((a, i) => (
                    <li key={i} className="flex items-start gap-3 p-3 rounded-md border bg-muted/30">
                      <Badge
                        variant={a.priority === "high" ? "default" : a.priority === "medium" ? "secondary" : "outline"}
                        className="shrink-0 capitalize"
                      >
                        {a.priority}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{a.title}</div>
                        <div className="text-sm text-muted-foreground mt-0.5">{a.detail}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Themes */}
          <div className="grid lg:grid-cols-2 gap-4">
            <ThemeCard
              icon={<ThumbsUp className="h-4 w-4 text-emerald-500" />}
              title="Positive themes"
              themes={insight.themes_positive ?? []}
              onQuoteClick={openReview}
            />
            <ThemeCard
              icon={<ThumbsDown className="h-4 w-4 text-red-500" />}
              title="Concerning themes"
              themes={insight.themes_negative ?? []}
              onQuoteClick={openReview}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeCard({
  icon, title, themes, onQuoteClick,
}: {
  icon: React.ReactNode;
  title: string;
  themes: { theme: string; count: number; example_quote: string; example_review_id?: string }[];
  onQuoteClick: (id?: string) => void;
}) {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">{icon} {title}</div>
        {themes.length === 0 ? (
          <div className="text-sm text-muted-foreground">No themes identified.</div>
        ) : (
          <ul className="space-y-3">
            {themes.map((t, i) => (
              <li key={i} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{t.theme}</span>
                  <Badge variant="outline" className="text-[10px]">×{t.count}</Badge>
                </div>
                {t.example_quote && (
                  <button
                    type="button"
                    onClick={() => t.example_review_id && onQuoteClick(t.example_review_id)}
                    className={`block text-left text-xs italic text-muted-foreground border-l-2 pl-3 ${t.example_review_id ? "hover:text-foreground hover:border-primary cursor-pointer" : "cursor-default"} transition-colors`}
                  >
                    “{t.example_quote}”
                    {t.example_review_id && <ExternalLink className="inline h-3 w-3 ml-1 opacity-60" />}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
