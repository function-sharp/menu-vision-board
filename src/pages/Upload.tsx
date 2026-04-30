import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload as UploadIcon, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw, Database } from "lucide-react";
import { useUploads } from "@/hooks/useDashboardData";
import { slugify, decodeText } from "@/lib/format";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type SyncState = { kind: "idle" } | { kind: "syncing" } | { kind: "done"; storesUpdated: number; promotionsUpserted: number; promotionsRemoved: number; unmatched: string[]; skipped: number } | { kind: "error"; msg: string };

type Status = { kind: "idle" } | { kind: "parsing" } | { kind: "uploading"; progress: number } | { kind: "success"; storesInserted: number; storesMerged: number; itemsInserted: number; itemsMerged: number; itemsKept: number } | { kind: "error"; msg: string };

export default function Upload() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [syncStatus, setSyncStatus] = useState<SyncState>({ kind: "idle" });
  const [filename, setFilename] = useState("");
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { data: uploads } = useUploads();

  const handleAirtableSync = async () => {
    setSyncStatus({ kind: "syncing" });
    try {
      const { data, error } = await supabase.functions.invoke("sync-airtable", { body: { direction: "pull" } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Sync failed");
      setSyncStatus({
        kind: "done",
        storesUpdated: data.stores_filled ?? 0,
        skipped: data.stores_skipped_supabase_wins ?? 0,
        promotionsUpserted: data.promotions_upserted ?? 0,
        promotionsRemoved: data.promotions_removed ?? 0,
        unmatched: data.stores_unmatched ?? [],
      });
      toast.success(`Pulled: ${data.stores_filled} filled, ${data.stores_skipped_supabase_wins} kept (Supabase wins)`);
      qc.invalidateQueries();
    } catch (e: any) {
      console.error(e);
      setSyncStatus({ kind: "error", msg: e.message ?? "Sync failed" });
      toast.error("Airtable sync failed: " + (e.message ?? "unknown"));
    }
  };

  const handleFile = async (file: File) => {
    setFilename(file.name);
    setStatus({ kind: "parsing" });
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === "all items") || wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);
      if (rows.length === 0) throw new Error("Sheet is empty");

      const required = ["store_name", "item_name"];
      const missing = required.filter((r) => !(r in rows[0]));
      if (missing.length) throw new Error(`Missing columns: ${missing.join(", ")}`);

      // Decode item names client-side so the edge function gets clean strings
      const cleanRows = rows.map((r) => ({
        ...r,
        item_name: decodeText(String(r.item_name ?? "")).trim() || "Unnamed",
        store_name: String(r.store_name ?? "").trim(),
      }));

      setStatus({ kind: "uploading", progress: 50 });

      const { data, error } = await supabase.functions.invoke("merge-excel", {
        body: { rows: cleanRows, filename: file.name, note: note || undefined },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Merge failed");

      setStatus({
        kind: "success",
        storesInserted: data.stores_inserted,
        storesMerged: data.stores_merged,
        itemsInserted: data.items_inserted,
        itemsMerged: data.items_merged,
        itemsKept: data.items_kept_untouched,
      });
      toast.success(
        `Merged: ${data.stores_inserted}+${data.stores_merged} stores · ${data.items_inserted}+${data.items_merged} items`,
      );
      qc.invalidateQueries();
      setNote("");
    } catch (e: any) {
      console.error(e);
      setStatus({ kind: "error", msg: e.message ?? "Upload failed" });
      toast.error("Upload failed: " + (e.message ?? "unknown"));
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Upload</h1>
        <p className="text-muted-foreground text-sm">Excel uploads now <strong>merge</strong> with the database — existing values are kept, blanks get filled. Supabase wins on conflicts.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Upload Excel file</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary/60 hover:bg-muted/30 transition-colors"
          >
            <UploadIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <div className="font-medium">Drop your .xlsx file here, or click to browse</div>
            <div className="text-xs text-muted-foreground mt-1">Must contain an "All Items" sheet with store_name and item_name columns.</div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>

          <div>
            <Label htmlFor="note" className="text-sm">Note (optional)</Label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Updated April 2026 menu" />
          </div>

          {status.kind === "parsing" && <Alert icon={FileSpreadsheet} text="Parsing spreadsheet..." />}
          {status.kind === "uploading" && (
            <div className="space-y-2">
              <Alert icon={UploadIcon} text={`Uploading ${filename}... ${status.progress}%`} />
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${status.progress}%` }} />
              </div>
            </div>
          )}
          {status.kind === "success" && <Alert icon={CheckCircle2} text={`Merged: ${status.storesInserted} new + ${status.storesMerged} existing stores · ${status.itemsInserted} new + ${status.itemsMerged} existing items · ${status.itemsKept} untouched.`} variant="success" />}
          {status.kind === "error" && <Alert icon={AlertCircle} text={status.msg} variant="error" />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" /> Sync from Airtable (Col'Cacchio OS)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pulls Uber Eats links onto matching stores and refreshes the Promotion Tracker. Runs only when you click Sync.
          </p>
          <Button onClick={handleAirtableSync} disabled={syncStatus.kind === "syncing"}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncStatus.kind === "syncing" ? "animate-spin" : ""}`} />
            {syncStatus.kind === "syncing" ? "Syncing..." : "Sync from Airtable"}
          </Button>

          {syncStatus.kind === "done" && (
            <div className="space-y-2">
              <Alert
                icon={CheckCircle2}
                variant="success"
                text={`Pull: ${syncStatus.storesUpdated} filled, ${syncStatus.skipped} kept (Supabase wins) · ${syncStatus.promotionsUpserted} promotions saved · ${syncStatus.promotionsRemoved} removed`}
              />
              {syncStatus.unmatched.length > 0 && (
                <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs">
                  <div className="font-medium mb-1 text-yellow-700">{syncStatus.unmatched.length} Airtable store(s) didn't match an existing store name:</div>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {syncStatus.unmatched.map((u) => <li key={u}>{u}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
          {syncStatus.kind === "error" && <Alert icon={AlertCircle} variant="error" text={syncStatus.msg} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent uploads</CardTitle></CardHeader>
        <CardContent className="p-0">
          {!uploads || uploads.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">No uploads yet.</div>
          ) : (
            <div className="divide-y">
              {uploads.map((u: any) => (
                <div key={u.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{u.filename ?? "Unknown file"}</div>
                    <div className="text-xs text-muted-foreground">{u.store_count} stores · {u.item_count} items {u.note ? `· ${u.note}` : ""}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(u.uploaded_at), { addSuffix: true })}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Alert({ icon: Icon, text, variant }: { icon: any; text: string; variant?: "success" | "error" }) {
  const cls = variant === "success" ? "bg-accent/10 text-accent border-accent/20" : variant === "error" ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-muted text-foreground border-border";
  return <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${cls}`}><Icon className="h-4 w-4" /><span>{text}</span></div>;
}
