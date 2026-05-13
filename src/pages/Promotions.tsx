import { useMemo, useState } from "react";
import { usePromotions } from "@/hooks/useDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Megaphone, Calendar, Search, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { usePageMeta } from "@/hooks/usePageMeta";

const statusVariants: Record<string, string> = {
  Approved: "bg-accent/15 text-accent border-accent/30",
  "In Review": "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  Draft: "bg-muted text-muted-foreground border-border",
  Live: "bg-primary/15 text-primary border-primary/30",
  Done: "bg-muted text-muted-foreground border-border",
};

export default function Promotions() {
  usePageMeta({ title: "Promotions · Col'Cacchio", description: "Active Col'Cacchio promotions, mechanics and approval status across stores." });
  const { data: promos, isLoading } = usePromotions();
  const [q, setQ] = useState("");
  const [month, setMonth] = useState("all");
  const [group, setGroup] = useState("all");
  const [status, setStatus] = useState("all");

  const { months, groups, statuses } = useMemo(() => {
    const m = new Set<string>(), g = new Set<string>(), s = new Set<string>();
    (promos ?? []).forEach((p) => {
      if (p.month) m.add(p.month);
      if (p.store_group) g.add(p.store_group);
      if (p.status) s.add(p.status);
    });
    return { months: [...m], groups: [...g], statuses: [...s] };
  }, [promos]);

  const filtered = useMemo(() => {
    if (!promos) return [];
    const ql = q.toLowerCase();
    return promos.filter((p) => {
      if (month !== "all" && p.month !== month) return false;
      if (group !== "all" && p.store_group !== group) return false;
      if (status !== "all" && p.status !== status) return false;
      if (!q) return true;
      const blob = [p.promo_id, p.messaging, p.mechanic, p.rationale, ...(p.theme ?? [])].join(" ").toLowerCase();
      return blob.includes(ql);
    });
  }, [promos, q, month, group, status]);

  const kpis = useMemo(() => {
    const list = promos ?? [];
    const now = new Date();
    const active = list.filter((p) => {
      if (!p.start_date || !p.end_date) return false;
      const s = new Date(p.start_date), e = new Date(p.end_date);
      return s <= now && now <= e;
    }).length;
    const review = list.filter((p) => (p.status ?? "").toLowerCase().includes("review")).length;
    return { total: list.length, active, review };
  }, [promos]);

  if (isLoading) return <Skeleton className="h-96" />;

  if (!promos || promos.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Promotions</h1>
          <p className="text-muted-foreground text-sm">Synced from Col'Cacchio OS · Promotion Tracker.</p>
        </div>
        <Card>
          <CardContent className="p-12 text-center space-y-3">
            <Megaphone className="h-10 w-10 mx-auto text-muted-foreground" />
            <div className="font-medium">No promotions synced yet</div>
            <div className="text-sm text-muted-foreground">Run an Airtable sync to pull the Promotion Tracker.</div>
            <Button asChild className="mt-2">
              <Link to="/upload"><RefreshCw className="h-4 w-4 mr-2" /> Go to Data Upload</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Promotions</h1>
          <p className="text-muted-foreground text-sm">{promos.length} promos from Col'Cacchio OS · Promotion Tracker.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/upload"><RefreshCw className="h-4 w-4 mr-2" /> Sync from Airtable</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="Total promos" value={kpis.total} />
        <Kpi label="Active now" value={kpis.active} accent />
        <Kpi label="Awaiting approval" value={kpis.review} />
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search promo, mechanic, rationale..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Month" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Group" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {groups.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground text-center">No promotions match these filters.</div>
          ) : (
            <Accordion type="multiple">
              {filtered.map((p) => {
                const statusCls = statusVariants[p.status ?? ""] ?? "bg-muted text-muted-foreground border-border";
                return (
                  <AccordionItem key={p.id} value={p.id} className="border-b last:border-b-0">
                    <AccordionTrigger className="hover:no-underline px-4 py-3">
                      <div className="flex flex-1 items-center justify-between gap-3 pr-3">
                        <div className="text-left min-w-0">
                          <div className="font-medium truncate">{p.promo_id || p.messaging?.slice(0, 60) || "Untitled promo"}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                            {(p.start_date || p.end_date) && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {p.start_date ? format(new Date(p.start_date), "d MMM") : "?"} – {p.end_date ? format(new Date(p.end_date), "d MMM") : "?"}
                              </span>
                            )}
                            {p.month && <span>· {p.month}</span>}
                            {p.store_group && <span>· {p.store_group}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {p.priority && <Badge variant="outline" className="hidden sm:inline-flex">{p.priority}</Badge>}
                          {p.status && <Badge className={statusCls + " border"}>{p.status}</Badge>}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <Field label="Theme">{(p.theme ?? []).map((t) => <Badge key={t} variant="outline" className="mr-1 mb-1">{t}</Badge>)}</Field>
                        <Field label="Offer Type">{p.offer_type ?? "—"}</Field>
                        <Field label="Audience">{p.audience ?? "—"}</Field>
                        <Field label="Margin Check">{p.margin_check ?? "—"}</Field>
                        <Field label="Funding Split">{p.funding_split ?? "—"}</Field>
                        <Field label="Recommended Items">{(p.recommended_items ?? []).join(", ") || "—"}</Field>
                        <Field label="Messaging" full>{p.messaging ?? "—"}</Field>
                        <Field label="Mechanic" full>{p.mechanic ?? "—"}</Field>
                        <Field label="Rationale" full>{p.rationale ?? "—"}</Field>
                        <Field label="Marketing approval">{p.marketing_approval ?? "—"}</Field>
                        <Field label="Operations approval">{p.operations_approval ?? "—"}</Field>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold mt-1 ${accent ? "text-primary" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      <div className="whitespace-pre-wrap leading-relaxed">{children}</div>
    </div>
  );
}
