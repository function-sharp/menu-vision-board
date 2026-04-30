import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export interface StorePdfMeta {
  storeName: string;
  storeGroup?: string | null;
  storeAddress?: string | null;
  rangeLabel: string; // e.g. "Last 24 months"
  /** Optional months covered by the report — used to compute formatted start/end dates. */
  rangeMonths?: number;
  generatedAt?: Date;
  kpis?: Array<{ label: string; value: string }>;
}

/** Build a "Mon YYYY – Mon YYYY (N months)" label from a months window ending now. */
export function formatRangeWindow(months: number, endDate: Date = new Date()): string {
  const end = new Date(endDate);
  const start = new Date(endDate);
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCMonth(start.getUTCMonth() - (months - 1));
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  return `${fmt(start)} – ${fmt(end)} (${months} month${months === 1 ? "" : "s"})`;
}

// ---- Shared KPI value formatters (used by callers for consistent display) ----

/** Whole number with thousands separators, e.g. 1284 → "1,284". */
export const fmtInt = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n) ? "—" : Math.round(n).toLocaleString();

/** Decimal with fixed digits + thousands separators, e.g. 4.3 → "4.30". */
export const fmtDecimal = (n: number | null | undefined, digits = 2): string =>
  n == null || !Number.isFinite(n)
    ? "—"
    : n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Rating out of 5, e.g. 4.321 → "4.32 / 5". */
export const fmtRating = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n) ? "—" : `${fmtDecimal(n, 2)} / 5`;

/** Percent from a 0–1 fraction, e.g. 0.6789 → "67.9%". */
export const fmtPctFromFraction = (n: number | null | undefined, digits = 1): string =>
  n == null || !Number.isFinite(n) ? "—" : `${(n * 100).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

/** Percent already on 0–100 scale. */
export const fmtPct = (n: number | null | undefined, digits = 1): string =>
  n == null || !Number.isFinite(n) ? "—" : `${n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

/** ZAR currency, no fractional cents on big numbers, e.g. 1234.5 → "R 1,234.50". */
export const fmtZAR = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n)
    ? "—"
    : `R ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Capture the given DOM element and embed it in a multi-page A4 PDF
 * along with a header (store name, range, KPIs) and footer.
 */
export async function exportStoreReportPdf(
  element: HTMLElement,
  meta: StorePdfMeta,
): Promise<void> {
  const generatedAt = meta.generatedAt ?? new Date();

  // Render the charts area off-screen at a fixed print-friendly width
  // so axis ticks, legends, and section headings stay crisp and consistent
  // regardless of the user's viewport width.
  const PRINT_WIDTH = 1100; // px — roughly matches A4 content area at 2x
  const clone = element.cloneNode(true) as HTMLElement;
  const stage = document.createElement("div");
  stage.style.position = "fixed";
  stage.style.left = "-10000px";
  stage.style.top = "0";
  stage.style.width = `${PRINT_WIDTH}px`;
  stage.style.background = "#ffffff";
  stage.style.padding = "0";
  stage.style.zIndex = "-1";
  clone.style.width = `${PRINT_WIDTH}px`;
  stage.appendChild(clone);
  document.body.appendChild(stage);

  // Allow Recharts ResponsiveContainer in the clone to lay out at the new width.
  await new Promise((r) => setTimeout(r, 350));

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(stage, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: PRINT_WIDTH,
      width: PRINT_WIDTH,
    });
  } finally {
    document.body.removeChild(stage);
  }

  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  // ---- Header ----
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(meta.storeName, margin, margin + 6);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(110);
  const subBits = [meta.storeGroup, meta.rangeLabel].filter(Boolean) as string[];
  if (subBits.length) {
    pdf.text(subBits.join(" · "), margin, margin + 22);
  }
  if (meta.storeAddress) {
    pdf.text(meta.storeAddress, margin, margin + 36);
  }
  pdf.setTextColor(0);

  // ---- KPI summary table ----
  let cursorY = margin + 56;
  if (meta.kpis && meta.kpis.length > 0) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(0);
    pdf.text("KPI summary", margin, cursorY);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(110);
    pdf.text(`Timeframe: ${meta.rangeLabel}`, margin, cursorY + 14);
    pdf.setTextColor(0);
    cursorY += 24;

    const rowH = 22;
    const padX = 12;
    // Wider metric column; values right-aligned in a narrower numeric column.
    const labelColW = contentWidth * 0.7;
    const valueColW = contentWidth - labelColW;
    const tableTop = cursorY;
    const rows = meta.kpis;
    const tableH = rowH * (rows.length + 1);

    // Header row fill
    pdf.setFillColor(245, 245, 247);
    pdf.rect(margin, tableTop, contentWidth, rowH, "F");

    // Outer border
    pdf.setDrawColor(220);
    pdf.setLineWidth(0.5);
    pdf.rect(margin, tableTop, contentWidth, tableH);

    // Header text — value header right-aligned to match the value column
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(80);
    pdf.text("METRIC", margin + padX, tableTop + 14);
    pdf.text("VALUE", margin + contentWidth - padX, tableTop + 14, { align: "right" });

    // Body rows with zebra striping + separators
    rows.forEach((k, i) => {
      const y = tableTop + rowH * (i + 1);
      if (i % 2 === 1) {
        pdf.setFillColor(250, 250, 251);
        pdf.rect(margin, y, contentWidth, rowH, "F");
      }
      pdf.setDrawColor(232);
      pdf.line(margin, y, margin + contentWidth, y);

      // Metric label (left, normal weight, slightly muted)
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(60);
      const labelMaxW = labelColW - padX * 2;
      const labelLines = pdf.splitTextToSize(k.label, labelMaxW);
      pdf.text(labelLines[0] ?? k.label, margin + padX, y + 14);

      // Value (right-aligned, monospaced for clean digit alignment)
      pdf.setFont("courier", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(0);
      const valueMaxW = valueColW - padX * 2;
      const valueLines = pdf.splitTextToSize(k.value, valueMaxW);
      pdf.text(valueLines[0] ?? k.value, margin + contentWidth - padX, y + 14, { align: "right" });
    });

    // Vertical column divider
    pdf.setDrawColor(232);
    pdf.line(margin + labelColW, tableTop, margin + labelColW, tableTop + tableH);

    cursorY = tableTop + tableH + 18;
  }

  // ---- Charts image (paginated if needed) ----
  const imgWidth = contentWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const dataUrl = canvas.toDataURL("image/png");

  const availablePerPage = pageHeight - margin * 2;
  if (imgHeight <= availablePerPage - (cursorY - margin)) {
    // Fits on first page below KPIs
    pdf.addImage(dataUrl, "PNG", margin, cursorY, imgWidth, imgHeight, undefined, "FAST");
  } else {
    // Slice the canvas vertically into page-sized chunks for clean pagination.
    const pxPerPt = canvas.width / imgWidth;
    const firstPageRoom = availablePerPage - (cursorY - margin);
    const firstSliceHeightPx = Math.max(0, Math.floor(firstPageRoom * pxPerPt));
    const fullPageSlicePx = Math.floor(availablePerPage * pxPerPt);

    let sourceY = 0;

    // First page slice (below KPIs)
    if (firstSliceHeightPx > 50) {
      const slice = sliceCanvas(canvas, sourceY, firstSliceHeightPx);
      const sliceHeightPt = firstSliceHeightPx / pxPerPt;
      pdf.addImage(slice.toDataURL("image/png"), "PNG", margin, cursorY, imgWidth, sliceHeightPt, undefined, "FAST");
      sourceY += firstSliceHeightPx;
    }

    while (sourceY < canvas.height) {
      pdf.addPage();
      const remaining = canvas.height - sourceY;
      const sliceHeightPx = Math.min(fullPageSlicePx, remaining);
      const slice = sliceCanvas(canvas, sourceY, sliceHeightPx);
      const sliceHeightPt = sliceHeightPx / pxPerPt;
      pdf.addImage(slice.toDataURL("image/png"), "PNG", margin, margin, imgWidth, sliceHeightPt, undefined, "FAST");
      sourceY += sliceHeightPx;
    }
  }

  // ---- Footer on every page ----
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(140);
    const footer = `Generated ${generatedAt.toLocaleString()} · Page ${p} of ${totalPages}`;
    pdf.text(footer, margin, pageHeight - 18);
  }

  const safeName = meta.storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  pdf.save(`${safeName || "store"}-review-report-${generatedAt.toISOString().slice(0, 10)}.pdf`);
}

function sliceCanvas(source: HTMLCanvasElement, sourceY: number, sliceHeight: number): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = sliceHeight;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, 0, sourceY, source.width, sliceHeight, 0, 0, source.width, sliceHeight);
  return out;
}
