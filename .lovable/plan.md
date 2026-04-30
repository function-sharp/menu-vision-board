# Col'Cacchio Menu Dashboard

An internal dashboard to explore 23 stores and ~2,780 menu items, with the ability to refresh data anytime by uploading a new Excel export.

## Pages & navigation

App shell with a left sidebar (collapsible) and top header showing total stores / items and a "Refresh data" button.

```text
┌─ Sidebar ──────────────┐  ┌─ Header: Stats + Upload Excel ──┐
│ Overview               │  │                                  │
│ Stores                 │  │  Active page                     │
│ Menu Browser           │  │                                  │
│ Item Comparison        │  │                                  │
│ Categories & Pricing   │  │                                  │
│ Data Upload            │  │                                  │
└────────────────────────┘  └──────────────────────────────────┘
```

### 1. Overview (home)
- KPI cards: total stores, total items, avg items/store, avg price, Classic vs GO split
- Bar chart: items per store (sorted)
- Bar chart: top 10 categories by item count
- Histogram: price distribution
- Table: stores by rating

### 2. Stores (directory)
- Sortable/filterable card grid: name, group (Classic/GO), rating + count, address, phone (click-to-call), price range ($$), item count
- Filter by group, search by name/address
- Click a card → Per-store menu page

### 3. Per-store menu page (`/stores/:slug`)
- Header: store name, group badge, rating, address, phone, cuisine tags, item count, avg price
- Category accordion: each category shows item count + price range; expanded list shows item name, description, price (ZAR formatted), with HTML entities (`&amp;`) decoded
- Search within store, sort by price/name
- Mini-stats: cheapest/most expensive item, category breakdown chart

### 4. Menu Browser (all items)
- Powerful searchable/sortable table of all 2,780 items: store, category, item, description, price
- Filters: store (multi), category (multi), price range slider, group
- Pagination (50/page) + CSV export of current view

### 5. Item Comparison
- Search box for an item name (e.g. "Margherita") with fuzzy matching
- Results table: one row per store offering it, with price, category, and a price chart across stores
- Highlights cheapest / most expensive store and price spread

### 6. Categories & Pricing analytics
- Avg/min/max price by category (bar)
- Avg price by store, Classic vs GO comparison
- Category presence matrix: stores × top categories (heatmap-style table)
- Price distribution box-style summary per group

### 7. Data Upload
- Drag-and-drop `.xlsx` upload, parsed in the browser (SheetJS)
- Validates required columns from the `All Items` sheet
- Replaces current data in the database, shows row counts and any skipped rows
- Shows last upload timestamp + uploader-supplied note

## Data handling

- Lovable Cloud (Supabase) stores two tables:
  - `stores` — name, slug, group, cuisine, rating, rating_count, telephone, address, price_range, store_url, item_count
  - `menu_items` — store_id, category, name, description, price, currency, deep_link
- An `uploads` table tracks each refresh (timestamp, row count, note)
- Public read access (RLS allows anon select); writes restricted to a server-side edge function called by the upload page
- HTML entity decoding (`&amp;`, smart quotes) applied at import

## Access

- No login. Anyone with the link can view and upload. (Can add auth later.)

## Design

- Clean light theme, Col'Cacchio-friendly accent (warm red/tomato) on dark text, generous spacing, shadcn cards/tables/charts (Recharts)
- Fully responsive; tables become stacked cards on mobile
- Currency formatted as `R 459` (ZAR)
- Empty/loading skeletons on every data view

## Technical notes

- Stack: React + Vite + Tailwind + shadcn + Recharts + Lovable Cloud
- Initial seed: parse the uploaded `colcacchio_output_1.xlsx` once via an edge function and insert into `stores` + `menu_items` so the dashboard is populated on first load
- Excel parsing on client uses `xlsx` (SheetJS); rows posted to an `ingest-menu` edge function in chunks
- Slugs generated from store names for stable URLs
- All charts use Recharts; tables use shadcn `Table` with TanStack-style sort/filter helpers