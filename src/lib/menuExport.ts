import { jsPDF } from "jspdf";
import { decodeText, formatZAR } from "@/lib/format";

export interface MenuExportItem {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  price: number | null;
  currency: string | null;
  created_at?: string | null;
  manually_edited_at?: string | null;
}

export interface MenuExportMeta {
  storeName: string;
  storeGroup?: string | null;
  storeAddress?: string | null;
  /** ISO date strings (yyyy-mm-dd). Either may be undefined for an open-ended bound. */
  rangeFrom?: string;
  rangeTo?: string;
  generatedAt?: Date;
  /** Optional set of fields to include in the output. Defaults to all common fields. */
  columns?: ColumnKey[];
}

export type ColumnKey =
  | "category"
  | "name"
  | "description"
  | "price"
  | "currency"
  | "created_at"
  | "manually_edited_at";

export const ALL_COLUMNS: { key: ColumnKey; label: string; required?: boolean }[] = [
  { key: "name", label: "Item name", required: true },
  { key: "category", label: "Category" },
  { key: "description", label: "Description" },
  { key: "price", label: "Price" },
  { key: "currency", label: "Currency" },
  { key: "created_at", label: "Created date" },
  { key: "manually_edited_at", label: "Last edited date" },
];

export const DEFAULT_COLUMNS: ColumnKey[] = [
  "category",
  "name",
  "description",
  "price",
  "currency",
  "created_at",
  "manually_edited_at",
];

// ---------- Filtering ----------

/**
 * Filter items to those that "exist" in the date window.
 *
 * The menu_items table only stores `created_at` (when scraped/inserted) and
 * `manually_edited_at` (last manual touch). It does NOT keep historical price
 * snapshots. So a date-range filter here means: items present in the catalogue
 * during that window — i.e. created on/before the end date, AND (if we have an
 * edit/created marker) touched on/after the start date.
 */
export function filterItemsByDateRange<T extends MenuExportItem>(
  items: T[],
  fromIso?: string,
  toIso?: string,
): T[] {
  const from = fromIso ? new Date(`${fromIso}T00:00:00Z`).getTime() : null;
  const to = toIso ? new Date(`${toIso}T23:59:59Z`).getTime() : null;

  return items.filter((i) => {
    const created = i.created_at ? new Date(i.created_at).getTime() : null;
    const touched = i.manually_edited_at ? new Date(i.manually_edited_at).getTime() : created;
    // If item was created after the window ended → didn't exist yet
    if (to != null && created != null && created > to) return false;
    // If item's most-recent touch is before the window started → treat as stale
    if (from != null && touched != null && touched < from) return false;
    // If we have no timestamps at all, include it (better to over-report than miss)
    return true;
  });
}

// ---------- CSV ----------

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildMenuCsv(items: MenuExportItem[], meta: MenuExportMeta): string {
  const cols = meta.columns && meta.columns.length ? meta.columns : DEFAULT_COLUMNS;
  const colSet = new Set<ColumnKey>(cols);
  // Always include store as a context column
  const headers: string[] = ["Store"];
  const colOrder: ColumnKey[] = [];
  for (const c of ALL_COLUMNS) {
    if (colSet.has(c.key)) {
      headers.push(c.label);
      colOrder.push(c.key);
    }
  }
  const lines: string[] = [headers.join(",")];
  for (const i of items) {
    const row: unknown[] = [meta.storeName];
    for (const key of colOrder) {
      switch (key) {
        case "name":
          row.push(decodeText(i.name));
          break;
        case "category":
          row.push(decodeText(i.category ?? ""));
          break;
        case "description":
          row.push(decodeText(i.description ?? "").replace(/\s+/g, " "));
          break;
        case "price":
          row.push(i.price != null ? Number(i.price).toFixed(2) : "");
          break;
        case "currency":
          row.push(i.currency ?? "ZAR");
          break;
        case "created_at":
          row.push(i.created_at ? new Date(i.created_at).toISOString().slice(0, 10) : "");
          break;
        case "manually_edited_at":
          row.push(i.manually_edited_at ? new Date(i.manually_edited_at).toISOString().slice(0, 10) : "");
          break;
      }
    }
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- PDF ----------

interface GroupStats {
  count: number;
  min: number | null;
  max: number | null;
  avg: number | null;
}

function statsFor(items: MenuExportItem[]): GroupStats {
  const prices = items.filter((i) => i.price != null).map((i) => Number(i.price));
  if (prices.length === 0) return { count: items.length, min: null, max: null, avg: null };
  return {
    count: items.length,
    min: Math.min(...prices),
    max: Math.max(...prices),
    avg: prices.reduce((a, b) => a + b, 0) / prices.length,
  };
}

export function exportMenuPdf(items: MenuExportItem[], meta: MenuExportMeta): void {
  const generatedAt = meta.generatedAt ?? new Date();
  const cols = new Set<ColumnKey>(meta.columns && meta.columns.length ? meta.columns : DEFAULT_COLUMNS);
  cols.add("name"); // always present
  const showCategory = cols.has("category");
  const showDescription = cols.has("description");
  const showPrice = cols.has("price");
  const showCurrency = cols.has("currency");
  const showCreated = cols.has("created_at");
  const showEdited = cols.has("manually_edited_at");
  const showMetaLine = showCreated || showEdited;

  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - margin - 18;

  const rangeLabel = formatRangeLabel(meta.rangeFrom, meta.rangeTo);

  const byCat = new Map<string, MenuExportItem[]>();
  for (const i of items) {
    const c = showCategory ? (i.category || "Other") : "All items";
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c)!.push(i);
  }
  const categories = Array.from(byCat.keys()).sort((a, b) => a.localeCompare(b));

  const overall = statsFor(items);

  const drawHeader = () => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.setTextColor(0);
    pdf.text(meta.storeName, margin, margin + 4);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(110);
    const sub = [meta.storeGroup, meta.storeAddress].filter(Boolean).join(" · ");
    if (sub) pdf.text(sub, margin, margin + 18);
    pdf.text(`Menu & pricing report · ${rangeLabel}`, margin, margin + 32);
    pdf.setTextColor(0);
  };

  drawHeader();
  let cursorY = margin + 52;

  const summaryRows: Array<[string, string]> = [
    ["Items in report", String(overall.count)],
    ["Categories", String(categories.length)],
  ];
  if (showPrice) {
    summaryRows.push(["Average price", overall.avg != null ? formatZAR(overall.avg) : "—"]);
    summaryRows.push([
      "Price range",
      overall.min != null && overall.max != null
        ? `${formatZAR(overall.min)} – ${formatZAR(overall.max)}`
        : "—",
    ]);
  }
  const sumRowH = 18;
  const sumColW = contentWidth / 2;
  const sumRowsCount = Math.ceil(summaryRows.length / 2);
  pdf.setLineWidth(0.5);
  pdf.setFillColor(245, 245, 247);
  pdf.rect(margin, cursorY, contentWidth, sumRowH * sumRowsCount, "F");
  pdf.setDrawColor(220);
  pdf.rect(margin, cursorY, contentWidth, sumRowH * sumRowsCount);
  summaryRows.forEach((r, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = margin + col * sumColW + 10;
    const y = cursorY + row * sumRowH + 12;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(110);
    pdf.text(r[0].toUpperCase(), x, y);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(0);
    pdf.text(r[1], x + 100, y);
  });
  cursorY += sumRowH * sumRowsCount + 16;

  const colCategoryX = margin;
  const colItemX = margin;
  const priceColW = showPrice ? 60 : 0;
  const itemColW = contentWidth - priceColW - (showPrice ? 8 : 0);

  const ensureSpace = (needed: number) => {
    if (cursorY + needed > bottomLimit) {
      pdf.addPage();
      drawHeader();
      cursorY = margin + 52;
    }
  };

  const drawCategoryHeader = (cat: string, s: GroupStats) => {
    ensureSpace(28);
    pdf.setFillColor(241, 243, 246);
    pdf.rect(margin, cursorY, contentWidth, 22, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(20);
    pdf.text(decodeText(cat), colCategoryX + 8, cursorY + 15);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    const right =
      showPrice && s.min != null && s.max != null
        ? `${s.count} items · ${formatZAR(s.min)} – ${formatZAR(s.max)}`
        : `${s.count} items`;
    pdf.text(right, margin + contentWidth - 8, cursorY + 15, { align: "right" });
    cursorY += 22;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    pdf.text("ITEM", colItemX + 4, cursorY + 11);
    if (showPrice) {
      pdf.text("PRICE", margin + contentWidth - 4, cursorY + 11, { align: "right" });
    }
    pdf.setDrawColor(230);
    pdf.line(margin, cursorY + 14, margin + contentWidth, cursorY + 14);
    cursorY += 16;
  };

  const drawItemRow = (item: MenuExportItem, zebra: boolean) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    const name = decodeText(item.name);
    const desc = showDescription && item.description
      ? decodeText(item.description).replace(/\s+/g, " ")
      : "";

    const nameLines = pdf.splitTextToSize(name, itemColW - 8) as string[];
    const descLines = desc
      ? (pdf.setFontSize(8), pdf.splitTextToSize(desc, itemColW - 8) as string[]).slice(0, 3)
      : [];

    const metaParts: string[] = [];
    if (showCreated && item.created_at) {
      metaParts.push(`Created ${new Date(item.created_at).toISOString().slice(0, 10)}`);
    }
    if (showEdited && item.manually_edited_at) {
      metaParts.push(`Edited ${new Date(item.manually_edited_at).toISOString().slice(0, 10)}`);
    }
    const metaLine = showMetaLine && metaParts.length ? metaParts.join(" · ") : "";

    pdf.setFontSize(10);
    const metaLineH = metaLine ? 11 : 0;
    const rowH = Math.max(20, nameLines.length * 12 + descLines.length * 9 + metaLineH + 6);

    ensureSpace(rowH);

    if (zebra) {
      pdf.setFillColor(250, 250, 251);
      pdf.rect(margin, cursorY, contentWidth, rowH, "F");
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(20);
    pdf.text(nameLines, colItemX + 4, cursorY + 12);

    let textY = cursorY + 12 + nameLines.length * 12;

    if (descLines.length) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(110);
      pdf.text(descLines, colItemX + 4, textY);
      textY += descLines.length * 9;
    }

    if (metaLine) {
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(7.5);
      pdf.setTextColor(140);
      pdf.text(metaLine, colItemX + 4, textY + 2);
    }

    if (showPrice) {
      pdf.setFont("courier", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(0);
      const currency = showCurrency && item.currency && item.currency !== "ZAR" ? ` ${item.currency}` : "";
      const priceText = item.price != null ? `${formatZAR(Number(item.price))}${currency}` : "—";
      pdf.text(priceText, margin + contentWidth - 4, cursorY + 12, { align: "right" });
    }

    pdf.setDrawColor(232);
    pdf.line(margin, cursorY + rowH, margin + contentWidth, cursorY + rowH);

    cursorY += rowH;
  };

  // ---- Render ----
  if (categories.length === 0) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(11);
    pdf.setTextColor(120);
    pdf.text("No menu items match the selected date range.", margin, cursorY + 20);
  }

  for (const cat of categories) {
    const list = byCat.get(cat)!.slice().sort((a, b) => a.name.localeCompare(b.name));
    drawCategoryHeader(cat, statsFor(list));
    list.forEach((it, idx) => drawItemRow(it, idx % 2 === 1));
    cursorY += 8; // spacer between categories
  }

  // ---- Footer on every page ----
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(140);
    const footer = `Generated ${generatedAt.toLocaleString()} · ${rangeLabel} · Page ${p} of ${totalPages}`;
    pdf.text(footer, margin, pageHeight - 18);
  }

  const safe = meta.storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const datePart = generatedAt.toISOString().slice(0, 10);
  pdf.save(`${safe || "store"}-menu-${datePart}.pdf`);
}

export function formatRangeLabel(fromIso?: string, toIso?: string): string {
  if (!fromIso && !toIso) return "All time";
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  if (fromIso && toIso) return `${fmt(fromIso)} – ${fmt(toIso)}`;
  if (fromIso) return `From ${fmt(fromIso)}`;
  return `Until ${fmt(toIso!)}`;
}
