import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Download, FileText, FileSpreadsheet, Info } from "lucide-react";
import {
  ALL_COLUMNS,
  buildMenuCsv,
  DEFAULT_COLUMNS,
  downloadCsv,
  exportMenuPdf,
  filterItemsByDateRange,
  formatRangeLabel,
  type ColumnKey,
  type MenuExportItem,
} from "@/lib/menuExport";
import { logActivity } from "@/lib/activityLog";

type Format = "pdf" | "csv";
type RangePreset = "all" | "30d" | "90d" | "12m" | "custom";

interface Props {
  trigger?: React.ReactNode;
  store: { id: string; name: string; slug: string; store_group?: string | null; address?: string | null };
  items: MenuExportItem[] | undefined;
}

const PRESETS: Array<{ value: RangePreset; label: string }> = [
  { value: "all", label: "All time" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
  { value: "custom", label: "Custom range" },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
function isoMonthsAgo(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);

export function MenuExportDialog({ trigger, store, items }: Props) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>("pdf");
  const [preset, setPreset] = useState<RangePreset>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>(today());
  const [busy, setBusy] = useState(false);
  const [columns, setColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS);

  const toggleColumn = (key: ColumnKey, checked: boolean) => {
    setColumns((prev) => {
      if (checked) return prev.includes(key) ? prev : [...prev, key];
      return prev.filter((k) => k !== key);
    });
  };

  // Resolve effective from/to based on the selected preset
  const { effFrom, effTo } = useMemo(() => {
    switch (preset) {
      case "30d":
        return { effFrom: isoDaysAgo(30), effTo: today() };
      case "90d":
        return { effFrom: isoDaysAgo(90), effTo: today() };
      case "12m":
        return { effFrom: isoMonthsAgo(12), effTo: today() };
      case "custom":
        return { effFrom: from || undefined, effTo: to || undefined };
      case "all":
      default:
        return { effFrom: undefined, effTo: undefined };
    }
  }, [preset, from, to]);

  const filtered = useMemo(() => {
    if (!items) return [];
    return filterItemsByDateRange(items, effFrom, effTo);
  }, [items, effFrom, effTo]);

  const handleExport = async () => {
    if (!items || items.length === 0) {
      toast.error("No menu items loaded for this store");
      return;
    }
    if (filtered.length === 0) {
      toast.error("No items match the selected date range");
      return;
    }
    setBusy(true);
    try {
      const meta = {
        storeName: store.name,
        storeGroup: store.store_group ?? null,
        storeAddress: store.address ?? null,
        rangeFrom: effFrom,
        rangeTo: effTo,
        columns,
      };
      if (format === "pdf") {
        exportMenuPdf(filtered, meta);
      } else {
        const csv = buildMenuCsv(filtered, meta);
        const date = new Date().toISOString().slice(0, 10);
        const safe = store.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        downloadCsv(`${safe || "store"}-menu-${date}.csv`, csv);
      }
      await logActivity({
        action: "menu.export",
        entity_type: "store",
        entity_id: store.id,
        entity_label: store.name,
        details: { format, range: formatRangeLabel(effFrom, effTo), count: filtered.length, columns },
      }).catch(() => undefined);
      toast.success(`${format.toUpperCase()} exported · ${filtered.length} items`);
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" /> Export menu
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export menu & pricing</DialogTitle>
          <DialogDescription>
            Generate a downloadable report of {store.name}'s menu items and prices.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Format */}
          <div className="space-y-2">
            <Label>Format</Label>
            <RadioGroup
              value={format}
              onValueChange={(v) => setFormat(v as Format)}
              className="grid grid-cols-2 gap-2"
            >
              <Label
                htmlFor="fmt-pdf"
                className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent transition ${
                  format === "pdf" ? "border-primary bg-accent/40" : ""
                }`}
              >
                <RadioGroupItem id="fmt-pdf" value="pdf" />
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">PDF report</span>
              </Label>
              <Label
                htmlFor="fmt-csv"
                className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent transition ${
                  format === "csv" ? "border-primary bg-accent/40" : ""
                }`}
              >
                <RadioGroupItem id="fmt-csv" value="csv" />
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">CSV (Excel)</span>
              </Label>
            </RadioGroup>
          </div>

          {/* Date range */}
          <div className="space-y-2">
            <Label>Date range</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map((p) => (
                <Button
                  key={p.value}
                  type="button"
                  size="sm"
                  variant={preset === p.value ? "default" : "outline"}
                  onClick={() => setPreset(p.value)}
                  className="h-8 text-xs justify-start"
                >
                  {p.label}
                </Button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="from" className="text-xs text-muted-foreground">From</Label>
                  <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={to || undefined} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="to" className="text-xs text-muted-foreground">To</Label>
                  <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from || undefined} max={today()} />
                </div>
              </div>
            )}
          </div>

          {/* Columns */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Fields to include</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setColumns(ALL_COLUMNS.map((c) => c.key))}
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setColumns(DEFAULT_COLUMNS)}
                >
                  Reset
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-md border p-2">
              {ALL_COLUMNS.map((col) => {
                const checked = columns.includes(col.key);
                const disabled = !!col.required;
                return (
                  <Label
                    key={col.key}
                    htmlFor={`col-${col.key}`}
                    className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm transition ${
                      disabled ? "opacity-70 cursor-not-allowed" : "cursor-pointer hover:bg-accent"
                    }`}
                  >
                    <Checkbox
                      id={`col-${col.key}`}
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={(v) => toggleColumn(col.key, v === true)}
                    />
                    <span>{col.label}</span>
                    {disabled && <span className="text-[10px] text-muted-foreground ml-auto">Required</span>}
                  </Label>
                );
              })}
            </div>
          </div>

          <div className="rounded-md border bg-muted/40 p-3 flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <div>
                <span className="font-semibold text-foreground">{filtered.length.toLocaleString()}</span>{" "}
                of {(items?.length ?? 0).toLocaleString()} items match{" "}
                <span className="font-medium text-foreground">{formatRangeLabel(effFrom, effTo)}</span>.
              </div>
              <div className="opacity-80">
                Date range filters items based on when they were added or last edited in the catalogue. Historical
                price snapshots are not stored, so prices reflect the latest known value.
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={busy || filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            {busy ? "Generating..." : `Download ${format.toUpperCase()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
