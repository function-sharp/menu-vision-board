## Goal

Protect the Col'Cacchio dashboard with email/password login. After this, the published URL shows a sign-in screen instead of live data. Only people you create accounts for can view or change anything.

## Decisions (from your answers)

- **Closed signup** — no public registration. You create users via Cloud → Users.
- **Auto-confirm** — new users can log in immediately, no email verification.

## What changes

### 1. Database — lock down RLS

Replace every "public" policy with "authenticated only" on all 8 tables:
`stores`, `menu_items`, `promotions`, `scrape_jobs`, `sync_runs`, `uploads`, `menu_filter_presets`. Read, insert, update, delete all require a logged-in session. Edge functions (`scrape-uber-eats`, `sync-airtable`, `merge-excel`) keep working because they use the service-role key.

### 2. Auth setting

Enable **auto-confirm signups** in Cloud auth config so accounts you create are immediately usable.

### 3. New files

- `src/hooks/useAuth.tsx` — `AuthProvider` + `useAuth()` hook. Sets up `onAuthStateChange` first, then `getSession()`. Exposes `session`, `user`, `loading`, `signOut`.
- `src/components/AuthGuard.tsx` — route wrapper. Redirects to `/auth` if no session. Shows a spinner during initial session check.
- `src/pages/Auth.tsx` — login page. Email + password fields, "Sign in" button, "Accounts are created by an administrator." note. No signup tab.

### 4. Routing (`src/App.tsx`)

```text
<AuthProvider>
  /auth                   → Auth page (public)
  AuthGuard
    AppLayout
      /, /stores, /menu, /compare, /analytics,
      /promotions, /uber-eats, /upload
  *                        → NotFound
</AuthProvider>
```

### 5. Sidebar — sign out

Add an "Account" footer block to `AppSidebar.tsx` showing the logged-in email and a "Sign out" button. Clicking signs out and the guard sends them back to `/auth`.

## Account creation

After this ships, create your first user once and log in:

1. Open Cloud → Users → "Add user"
2. Enter your email + a password, tick "Auto Confirm User"
3. Visit the dashboard → log in

Repeat for each teammate. No invite emails are sent (auto-confirm + closed signup).

## What stays the same

- All edge functions (scrape, Airtable sync, Excel merge) — unchanged, still use service role.
- Inline editing, bulk scrape, sync log polling — unchanged, just gated behind login.
- Existing data — untouched.

## Out of scope (can add later)

- Roles/admin tier, password reset flow, Google sign-in, audit log of who edited what.

After approval I'll apply the migration, flip the auto-confirm setting, write the 3 new files, update `App.tsx` and `AppSidebar.tsx`, and you can create your first account in Cloud → Users.
