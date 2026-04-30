import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload as UploadIcon, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { useUploads } from "@/hooks/useDashboardData";
import { slugify, decodeText } from "@/lib/format";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Status = { kind: "idle" } | { kind: "parsing" } | { kind: "uploading"; progress: number } | { kind: "success"; stores: number; items: number } | { kind: "error"; msg: string };

export default function Upload() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [filename, setFilename] = useState("");
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { data: uploads } = useUploads();

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

      // Build stores map
      const storeMap = new Map<string, any>();
      for (const r of rows) {
        const name = String(r.store_name ?? "").trim();
        if (!name || storeMap.has(name)) continue;
        storeMap.set(name, {
          name, slug: slugify(name),
          store_group: r.group ?? null,
          cuisine: r.cuisine ?? null,
          rating: r.rating != null ? Number(r.rating) : null,
          rating_count: r.rating_count != null ? Number(r.rating_count) : null,
          telephone: r.telephone != null ? String(r.telephone) : null,
          address: r.address ?? null,
          price_range: r.price_range ?? null,
          store_url: r.store_url ?? null,
          item_count: 0,
        });
      }
      // count items per store
      for (const r of rows) {
        const s = storeMap.get(String(r.store_name ?? "").trim());
        if (s) s.item_count++;
      }

      setStatus({ kind: "uploading", progress: 5 });

      // Wipe existing data
      await supabase.from("menu_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("stores").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      setStatus({ kind: "uploading", progress: 15 });

      // Insert stores
      const storesArr = Array.from(storeMap.values());
      const { data: insertedStores, error: sErr } = await supabase.from("stores").insert(storesArr).select("id, name");
      if (sErr) throw sErr;

      const idByName = new Map(insertedStores!.map((s: any) => [s.name, s.id]));
      setStatus({ kind: "uploading", progress: 30 });

      // Insert items in chunks
      const items = rows.map((r) => ({
        store_id: idByName.get(String(r.store_name ?? "").trim()),
        category: r.category ?? null,
        name: decodeText(String(r.item_name ?? "")).trim() || "Unnamed",
        description: r.item_description ?? null,
        price: r.item_price != null ? Number(r.item_price) : null,
        currency: r.item_currency ?? "ZAR",
        deep_link: r.item_deep_link ?? null,
      })).filter((i) => i.store_id);

      const chunkSize = 500;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const { error } = await supabase.from("menu_items").insert(chunk);
        if (error) throw error;
        setStatus({ kind: "uploading", progress: 30 + Math.round((i / items.length) * 65) });
      }

      await supabase.from("uploads").insert({
        store_count: storesArr.length, item_count: items.length, note: note || null, filename: file.name,
      });

      setStatus({ kind: "success", stores: storesArr.length, items: items.length });
      toast.success(`Imported ${storesArr.length} stores and ${items.length} items`);
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
        <p className="text-muted-foreground text-sm">Upload an updated Col'Cacchio menu Excel file. This replaces all existing data.</p>
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
          {status.kind === "success" && <Alert icon={CheckCircle2} text={`Successfully imported ${status.stores} stores and ${status.items} items.`} variant="success" />}
          {status.kind === "error" && <Alert icon={AlertCircle} text={status.msg} variant="error" />}
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
