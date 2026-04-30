import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export interface StorePdfMeta {
  storeName: string;
  storeGroup?: string | null;
  storeAddress?: string | null;
  rangeLabel: string; // e.g. "Last 24 months"
  generatedAt?: Date;
  kpis?: Array<{ label: string; value: string }>;
}

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

  // ---- KPI strip ----
  let cursorY = margin + 56;
  if (meta.kpis && meta.kpis.length > 0) {
    const cols = Math.min(meta.kpis.length, 4);
    const cellW = contentWidth / cols;
    const cellH = 44;
    pdf.setDrawColor(220);
    pdf.setLineWidth(0.5);
    meta.kpis.slice(0, cols).forEach((k, i) => {
      const x = margin + i * cellW;
      pdf.roundedRect(x + 2, cursorY, cellW - 4, cellH, 4, 4);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(110);
      pdf.text(k.label.toUpperCase(), x + 10, cursorY + 14);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(0);
      pdf.text(k.value, x + 10, cursorY + 32);
    });
    cursorY += cellH + 16;
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
