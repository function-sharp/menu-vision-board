## Goal

Make the Col'Cacchio brand show up consistently everywhere: browser tab, top header, sidebar, and the sign-in screen — using the existing favicon image (already the Col'Cacchio logo) as the single source of truth, inspired by colcacchio.co.za's warm red/cream identity (already reflected in the theme).

## What changes

### 1. Reusable brand logo component
Create `src/components/BrandLogo.tsx` — a small component that renders the Col'Cacchio logo image (`/favicon.png`) plus the wordmark "Col'Cacchio" with the subtitle "Menu Dashboard". Props: `size` (sm/md/lg), `showWordmark` (bool), `subtitle` (optional override). This becomes the one place branding lives, so future logo swaps are a one-file change.

### 2. Header (`src/components/AppLayout.tsx`)
Add the `BrandLogo` (small, with wordmark) to the left of the sidebar trigger so the brand is always visible at the top of every page. On mobile (<sm) only the logo mark shows; on desktop the wordmark appears too. Stats ("X stores · Y items") move slightly right.

### 3. Sidebar (`src/components/AppSidebar.tsx`)
Replace the generic `Pizza` lucide icon in the sidebar header with the actual logo image (via `BrandLogo` in icon-only mode when collapsed, full mode when expanded). Keeps the existing "Col'Cacchio / Menu Dashboard" two-line label.

### 4. Sign-in screen (`src/pages/Auth.tsx`)
Swap the `Pizza` icon in the auth card for the real logo image so the first impression matches the rest of the app.

### 5. Browser tab (`index.html`)
Already has `favicon.png` and a good title. Add an Apple touch icon link for mobile home-screen consistency:
```html
<link rel="apple-touch-icon" href="/favicon.png">
```
Title stays "Col'Cacchio Menu Dashboard".

## Out of scope
- No color/theme changes — the warm cream + tomato-red palette already matches colcacchio.co.za.
- No new logo asset — reusing `public/favicon.png` the user already uploaded.
- No marketing/landing page changes.

## Files touched
- Create: `src/components/BrandLogo.tsx`
- Edit: `src/components/AppLayout.tsx`, `src/components/AppSidebar.tsx`, `src/pages/Auth.tsx`, `index.html`
