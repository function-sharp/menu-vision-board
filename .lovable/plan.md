# Add Uber Eats Dashboard Page

A new `/uber-eats` page that combines store coverage and item-level Uber Eats links in one view, with sidebar navigation and a link from each Store detail page.

## Page layout

```text
/uber-eats
├── Header: title + summary stats
├── Coverage cards (3): stores w/ link · items w/ item link · items w/ store-only fallback
├── Section A — Stores
│   ├── Search + group filter
│   └── Table: Store · Group · Item count · URL · [Open] [Copy]
└── Section B — Items
    ├── Search + store filter + link-type filter (item / store / either)
    └── Table: Item · Store · Category · Price · Link type · [Open] [Copy]

Each section has its own [Export CSV] button.
```

## Behaviour

- **Open on Uber Eats**: opens `uber_eats_url` (store row) or `deep_link ?? stores.uber_eats_url` (item row) in a new tab.
- **Copy link**: copies the same URL to clipboard with a toast confirmation.
- **Export CSV**: exports the currently filtered rows of that section.
- Stores without an Uber Eats URL are hidden by default with a toggle "Show stores missing a link" so you can spot gaps.
- Items section default filter = "Has any Uber Eats link". Toggle includes item-only, store-only-fallback, or any.

## Navigation

- Add **Uber Eats** entry to `AppSidebar.tsx` (icon: `ExternalLink` from lucide), placed under Promotions.
- On `StoreDetail.tsx`, add a small "View on Uber Eats hub" link beside the existing Uber Eats button so the store page connects back to the new hub.

## Technical details

**New file**: `src/pages/UberEats.tsx`
- Uses existing hooks `useStores()` and `useAllItems()` — no new queries needed (both already include `uber_eats_url` / `deep_link`).
- Derives:
  - `storesWithLink = stores.filter(s => s.uber_eats_url)`
  - `itemsWithItemLink = items.filter(i => i.deep_link)`
  - `itemsStoreFallback = items.filter(i => !i.deep_link && i.stores.uber_eats_url)`
- Reuses shadcn `Card`, `Table`, `Input`, `Select`, `Badge`, `Button`, and `sonner` toast.
- CSV export reuses the same blob pattern already used in `MenuBrowser.tsx`.

**Edits**:
- `src/App.tsx` — register route `<Route path="/uber-eats" element={<UberEats />} />`.
- `src/components/AppSidebar.tsx` — add nav item `{ title: "Uber Eats", url: "/uber-eats", icon: ExternalLink }`.
- `src/pages/StoreDetail.tsx` — add a small `Link` to `/uber-eats` near the existing Uber Eats action.

**No database changes** — all required columns (`stores.uber_eats_url`, `menu_items.deep_link`) already exist.

## Out of scope

- Editing `uber_eats_url` from this page (you said no edit action).
- Backend sync changes — this page is read-only over current data.
