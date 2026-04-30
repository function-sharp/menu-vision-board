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
import { Search, RefreshCw, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

const PAGE_SIZE = 100;

function categoryOf(action: string): string {
  if (action.startsWith("store.") || action.startsWith("scrape.")) return "stores";
  if (action.startsWith("menu_item.")) return "menu";
  if (action.startsWith("menu_filter_preset.")) return "presets";
  if (action.startsWith("sync.")) return "sync";
  if (action.startsWith("upload.")) return "upload";
  return "other";
}

function badgeVariant(action: string): "default" | "secondary" | "destructive" | "outline" {
  if (action.endsWith(".failed")) return "destructive";
  if (action.startsWith("sync.") || action.startsWith("upload.")) return "default";
  if (action.startsWith("scrape.")) return "secondary";
  return "outline";
}

export default function ActivityLog() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");

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

  const filtered = useMemo(() => {
    const rows = data ?? [];
    return rows.filter((r) => {
      if (category !== "all" && categoryOf(r.action) !== category) return false;
      if (!q) return true;
      const hay = [r.action, r.entity_label, r.entity_id, r.user_email, JSON.stringify(r.details ?? {})]
        .join(" ")
        .toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [data, q, category]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <History className="h-6 w-6" /> Activity Log
          </h1>
          <p className="text-sm text-muted-foreground">
            Recent edits, syncs, scrapes, and uploads. Newest first.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search action, entity, user..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="stores">Stores</SelectItem>
              <SelectItem value="menu">Menu items</SelectItem>
              <SelectItem value="presets">Filter presets</SelectItem>
              <SelectItem value="sync">Syncs</SelectItem>
              <SelectItem value="upload">Uploads</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
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
              No activity yet. Actions will appear here as you edit data, run syncs, or upload files.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">When</TableHead>
                  <TableHead className="w-[200px]">Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead className="w-[200px]">User</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-muted-foreground" title={new Date(row.created_at).toLocaleString()}>
                      {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badgeVariant(row.action)} className="font-mono text-[10px]">
                        {row.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
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
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {row.user_email ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.details ? (
                        <pre className="max-w-[420px] truncate text-muted-foreground font-mono text-[11px]">
                          {JSON.stringify(row.details)}
                        </pre>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
