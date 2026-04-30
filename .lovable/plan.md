## Add KPI summary table to PDF export

Today the exported PDF shows a compact 4-card KPI strip at the very top. We'll replace it with a clearly-labeled **KPI summary** table that lists each metric on its own row — making totals, averages, reply rate, and the timeframe immediately scannable at the top of the report.

### What changes

1. **PDF layout (`src/lib/pdfReport.ts`)**
   - Replace the 4-cell rounded card strip with a section titled **"KPI summary"**.
   - Show the selected timeframe as a sub-heading directly under it (e.g. *"Timeframe: Last 24 months"*).
   - Render a two-column bordered table:
     - Header row (light grey fill): **METRIC | VALUE**
     - One row per KPI passed in, with zebra striping and thin row separators.
   - Table grows to fit however many KPIs are passed in (no longer capped at 4).
   - Cursor advances correctly so the captured charts image still paginates cleanly below.

2. **Single-store report (`src/pages/StoreDetail.tsx`)**
   Expand the KPI list passed to `exportStoreReportPdf` from 4 items to a fuller summary:
   - Timeframe (e.g. "Last 24 months")
   - Total reviews
   - Average rating (e.g. "4.32 / 5")
   - Reply rate (e.g. "68%")
   - Reviews in last 30 days
   - Reviews in selected range (sum of monthly buckets)
   - Average monthly reviews (range total ÷ months)
   - 1★ count and 5★ count (from the rating distribution)

3. **Comparison report (`src/components/reviews/ComparisonPanel.tsx`)**
   Pass an aggregated KPI list across the selected stores:
   - Timeframe
   - Stores compared
   - Total reviews (sum across stores)
   - Weighted average rating across stores
   - Average reply rate across stores
   - Reviews in last 30 days (sum)
   - Top store by volume (name + count)
   - Top store by rating (name + value)

### Layout sketch

```text
+------------------------------------------------------+
|  Store name                                          |
|  Group · Last 24 months                              |
|  Address                                             |
|                                                      |
|  KPI summary                                         |
|  Timeframe: Last 24 months                           |
|  +------------------------------+------------------+ |
|  | METRIC                       | VALUE            | |
|  +------------------------------+------------------+ |
|  | Total reviews                | 1,284            | |
|  | Average rating               | 4.32 / 5         | |
|  | Reply rate                   | 68%              | |
|  | Reviews in last 30 days      | 47               | |
|  | Reviews in selected range    | 612              | |
|  | Average reviews / month      | 25.5             | |
|  | 5★ reviews                   | 812              | |
|  | 1★ reviews                   | 41               | |
|  +------------------------------+------------------+ |
|                                                      |
|  [ chart sections continue below ... ]               |
+------------------------------------------------------+
```

### Notes / constraints

- The PDF generator is purely client-side (`jspdf` + `html2canvas`) — no backend changes needed.
- Table is drawn with `jspdf` primitives (rect/line/text) for crisp vector output, not rasterised.
- Pagination logic for the captured charts image is preserved; only the cursor start position changes.
- No new dependencies.
