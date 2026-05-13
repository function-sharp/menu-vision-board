import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Search,
  RefreshCw,
  History,
  X,
  Download,
  ChevronDown,
  ChevronRight,
  Store as StoreIcon,
  Utensils,
  Bookmark,
  RefreshCcw,
  UploadCloud,
  Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { usePageMeta } from "@/hooks/usePageMeta";

type LogRow = {
  id: string;
  created_at: string;
  user_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  details: Record<string, unknown> | null;
};

const PAGE_SIZE = 500;

type Category = "stores" | "menu" | "presets" | "sync" | "upload" | "other";

function categoryOf(action: string): Category {
  if (action.startsWith("store.") || action.startsWith("scrape.")) return "stores";
  if (action.startsWith("menu_item.")) return "menu";
  if (action.startsWith("menu_filter_preset.")) return "presets";
  if (action.startsWith("sync.")) return "sync";
  if (action.startsWith("upload.")) return "upload";
  return "other";
}

const CATEGORY_META: Record<Category, { label: string; Icon: typeof StoreIcon }> = {
  stores: { label: "Stores", Icon: StoreIcon },
  menu: { label: "Menu items", Icon: Utensils },
  presets: { label: "Filter presets", Icon: Bookmark },
  sync: { label: "Syncs", Icon: RefreshCcw },
  upload: { label: "Uploads", Icon: UploadCloud },
  other: { label: "Other", Icon: Activity },
};

function badgeVariant(action: string): "default" | "secondary" | "destructive" | "outline" {
  if (action.endsWith(".failed")) return "destructive";
  if (action.startsWith("sync.") || action.startsWith("upload.")) return "default";
  if (action.startsWith("scrape.")) return "secondary";
  return "outline";
}

type TimeRange = "all" | "1h" | "24h" | "7d" | "30d";
type Status = "all" | "success" | "failed";
type SortDir = "newest" | "oldest";

const TIME_RANGE_MS: Record<Exclude<TimeRange, "all">, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

function toCsv(rows: LogRow[]): string {
  const headers = ["created_at", "action", "entity_type", "entity_id", "entity_label", "user_email", "details"];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.created_at,
        r.action,
        r.entity_type,
        r.entity_id,
        r.entity_label,
        r.user_email,
        r.details ? JSON.stringify(r.details) : "",
      ]
        .map(escape)
        .join(","),
    );
  }
  return lines.join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ActivityLog() {
  usePageMeta({ title: "Activity Log · Col'Cacchio", description: "Audit trail of dashboard activity, scrapes, uploads and edits." });
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [entityType, setEntityType] = useState<string>("all");
  const [user, setUser] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [status, setStatus] = useState<Status>("all");
  const [sortDir, setSortDir] = useState<SortDir>("newest");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["activity-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;
      return (data ?? []) as unknown as LogRow[];
    },
  });

  const rows = data ?? [];

  // Build filter option lists from loaded rows
  const entityTypes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.entity_type).filter(Boolean) as string[])).sort(),
    [rows],
  );
  const users = useMemo(
    () => Array.from(new Set(rows.map((r) => r.user_email).filter(Boolean) as string[])).sort(),
    [rows],
  );
  const actions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (category === "all" || categoryOf(r.action) === category) set.add(r.action);
    }
    return Array.from(set).sort();
  }, [rows, category]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const now = Date.now();
    const cutoff = timeRange === "all" ? null : now - TIME_RANGE_MS[timeRange];

    let result = rows.filter((r) => {
      if (category !== "all" && categoryOf(r.action) !== category) return false;
      if (entityType !== "all" && r.entity_type !== entityType) return false;
      if (user !== "all" && r.user_email !== user) return false;
      if (action !== "all" && r.action !== action) return false;
      if (status === "failed" && !r.action.endsWith(".failed")) return false;
      if (status === "success" && r.action.endsWith(".failed")) return false;
      if (cutoff && new Date(r.created_at).getTime() < cutoff) return false;
      if (!ql) return true;
      const hay = [
        r.action,
        r.entity_type,
        r.entity_label,
        r.entity_id,
        r.user_email,
        JSON.stringify(r.details ?? {}),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(ql);
    });

    if (sortDir === "oldest") result = [...result].reverse();
    return result;
  }, [rows, q, category, entityType, user, action, status, timeRange, sortDir]);

  const counts = useMemo(() => {
    const out: Record<Category, number> = { stores: 0, menu: 0, presets: 0, sync: 0, upload: 0, other: 0 };
    for (const r of filtered) out[categoryOf(r.action)]++;
    return out;
  }, [filtered]);

  const failedCount = useMemo(() => filtered.filter((r) => r.action.endsWith(".failed")).length, [filtered]);

  const activeFilters: { key: string; label: string; clear: () => void }[] = [];
  if (q) activeFilters.push({ key: "q", label: `“${q}”`, clear: () => setQ("") });
  if (category !== "all")
    activeFilters.push({ key: "cat", label: CATEGORY_META[category].label, clear: () => setCategory("all") });
  if (entityType !== "all")
    activeFilters.push({ key: "et", label: `Entity: ${entityType}`, clear: () => setEntityType("all") });
  if (user !== "all") activeFilters.push({ key: "user", label: `User: ${user}`, clear: () => setUser("all") });
  if (action !== "all") activeFilters.push({ key: "act", label: `Action: ${action}`, clear: () => setAction("all") });
  if (status !== "all")
    activeFilters.push({ key: "status", label: status === "failed" ? "Failed only" : "Success only", clear: () => setStatus("all") });
  if (timeRange !== "all")
    activeFilters.push({ key: "time", label: `Last ${timeRange}`, clear: () => setTimeRange("all") });

  const clearAll = () => {
    setQ("");
    setCategory("all");
    setEntityType("all");
    setUser("all");
    setAction("all");
    setStatus("all");
    setTimeRange("all");
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <History className="h-6 w-6" /> Activity Log
          </h1>
          <p className="text-sm text-muted-foreground">
            Recent edits, syncs, scrapes, and uploads. Newest first.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv(`activity-log-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(filtered))}
            disabled={filtered.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Category quick filters */}
      <div className="flex flex-wrap gap-2">
        <CategoryChip
          label="All"
          count={filtered.length}
          active={category === "all"}
          onClick={() => setCategory("all")}
        />
        {(Object.keys(CATEGORY_META) as Category[]).map((c) => {
          const { label, Icon } = CATEGORY_META[c];
          return (
            <CategoryChip
              key={c}
              icon={<Icon className="h-3.5 w-3.5" />}
              label={label}
              count={counts[c]}
              active={category === c}
              onClick={() => setCategory(c)}
            />
          );
        })}
        {failedCount > 0 && (
          <CategoryChip
            label={`Failed`}
            count={failedCount}
            active={status === "failed"}
            destructive
            onClick={() => setStatus(status === "failed" ? "all" : "failed")}
          />
        )}
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Filters</CardTitle>
          {activeFilters.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearAll}>
              <X className="h-3 w-3 mr-1" /> Clear all
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search store name, item, preset name, user, ID..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-8"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any time</SelectItem>
                <SelectItem value="1h">Last hour</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortDir} onValueChange={(v) => setSortDir(v as SortDir)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Entity type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entity types</SelectItem>
                {entityTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={user} onValueChange={setUser}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="User" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-[260px]"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actions.map((a) => (
                  <SelectItem key={a} value={a}><span className="font-mono text-xs">{a}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {activeFilters.map((f) => (
                <Badge key={f.key} variant="secondary" className="gap-1 font-normal">
                  {f.label}
                  <button
                    type="button"
                    onClick={f.clear}
                    className="hover:text-destructive"
                    aria-label={`Clear ${f.label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filtered.length}</span> of {rows.length} loaded
            {rows.length === PAGE_SIZE && " (limit reached — refine filters or refresh)"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {rows.length === 0
                ? "No activity yet. Actions will appear here as you edit data, run syncs, or upload files."
                : "No entries match the current filters."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[32px]" />
                    <TableHead className="w-[160px]">When</TableHead>
                    <TableHead className="w-[220px]">Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead className="w-[200px]">User</TableHead>
                    <TableHead>Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const isOpen = expanded.has(row.id);
                    const cat = categoryOf(row.action);
                    const { Icon } = CATEGORY_META[cat];
                    const summary = row.details ? summarizeDetails(row.details) : "";
                    return (
                      <Collapsible
                        key={row.id}
                        open={isOpen}
                        onOpenChange={() => toggleExpand(row.id)}
                        asChild
                      >
                        <>
                          <TableRow className="group">
                            <TableCell className="align-top">
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                  {isOpen ? (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            </TableCell>
                            <TableCell
                              className="text-xs text-muted-foreground align-top"
                              title={new Date(row.created_at).toLocaleString()}
                            >
                              {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="flex items-center gap-1.5">
                                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <Badge variant={badgeVariant(row.action)} className="font-mono text-[10px]">
                                  {row.action}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs align-top">
                              {row.entity_label ? (
                                <div>
                                  <div className="font-medium">{row.entity_label}</div>
                                  {row.entity_type && (
                                    <div className="text-muted-foreground">{row.entity_type}</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">{row.entity_type ?? "—"}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground truncate max-w-[200px] align-top">
                              {row.user_email ?? "—"}
                            </TableCell>
                            <TableCell className="text-xs align-top">
                              <span className="text-muted-foreground line-clamp-1">{summary || "—"}</span>
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow>
                              <TableCell />
                              <TableCell colSpan={5} className="bg-muted/30">
                                <div className="space-y-2 py-2 text-xs">
                                  {row.entity_id && (
                                    <div>
                                      <span className="text-muted-foreground">Entity ID: </span>
                                      <span className="font-mono">{row.entity_id}</span>
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-muted-foreground">Details:</span>
                                    <pre className="mt-1 max-w-full overflow-x-auto rounded bg-background p-2 font-mono text-[11px]">
                                      {row.details ? JSON.stringify(row.details, null, 2) : "—"}
                                    </pre>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CategoryChip({
  label,
  count,
  active,
  onClick,
  icon,
  destructive,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? destructive
            ? "bg-destructive text-destructive-foreground border-destructive"
            : "bg-primary text-primary-foreground border-primary"
          : "bg-background hover:bg-accent hover:text-accent-foreground",
      ].join(" ")}
    >
      {icon}
      <span>{label}</span>
      <span
        className={[
          "rounded-full px-1.5 text-[10px] tabular-nums",
          active ? "bg-background/20" : "bg-muted text-muted-foreground",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );
}

function summarizeDetails(details: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(details)) {
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    let str: string;
    if (typeof v === "object") str = JSON.stringify(v);
    else str = String(v);
    if (str.length > 60) str = str.slice(0, 57) + "…";
    parts.push(`${k}: ${str}`);
    if (parts.length >= 4) break;
  }
  return parts.join(" · ");
}
