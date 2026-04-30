## Plan: Uber Eats column in Menu Browser

Add a new "Uber Eats" column to the Menu Browser table that opens the correct listing for each row.

### Link priority per row
1. **Item-level deep link** (`menu_items.deep_link`) — already in the DB from the Excel import, links straight to that item on Uber Eats. Labeled **"Item"**.
2. **Store-level Uber Eats URL** (`stores.uber_eats_url`) — fallback from the Airtable sync. Labeled **"Store"**.
3. Neither available → show "—".

A small tooltip clarifies which kind of link it is. Opens in a new tab.

### Changes

**`src/hooks/useDashboardData.ts`** — extend the `useAllItems` joined select to include `deep_link` and `stores.uber_eats_url`, and update the return type.

**`src/pages/MenuBrowser.tsx`**
- Add `ExternalLink` icon import.
- Add a new right-aligned **"Uber Eats"** column header.
- Render an `<a target="_blank">` with the chosen URL and an "Item" / "Store" label.
- Include the URL in the **CSV export** as a new "Uber Eats URL" column.

No DB changes, no edge function changes — both fields already exist.
