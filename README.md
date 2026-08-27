Margav Portal — Margav Heating's internal operations portal (Next.js 16 App Router, React 19, Tailwind v4, Supabase).

## Setup

The app is fully backed by Supabase (database + auth) — it won't run without a connected project. Steps:

1. Create a project at [supabase.com](https://supabase.com) (or open an existing one).
2. Open the project's SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql) — this creates every table, the `profiles` auto-provisioning trigger, and Row Level Security policies. Also run any files under `supabase/migrations/` (in filename order) if present.
3. Copy `.env.local.example` to `.env.local` and fill in your project's URL/anon key from **Project Settings → API**.
4. Under **Authentication → Users**, add yourself as a user — there is no public sign-up page; accounts are invite-only.
5. `npm install` then `npm run dev`, and sign in at `/login`.

Until steps 1–3 are done, the app shows a "Connect Supabase" setup screen instead of crashing.

## Development

```bash
npm run dev     # start the dev server
npm run lint    # eslint
npm run build   # production build
```

Open [http://localhost:3000](http://localhost:3000) after `npm run dev`.

## Architecture notes

- **Auth**: Supabase Auth (email + password, invite-only). Session/redirect logic lives in `src/proxy.ts` + `src/lib/supabase/proxy.ts` — note this project is on Next.js 16, which renamed `middleware.ts` to `proxy.ts` (same API, different file/export name).
- **Data access**: `src/data/*-service.ts` wrap Supabase queries behind the same function names the UI already called when this was mock data. Mutations go through Server Actions (colocated `actions.ts` files) rather than a REST API layer.
- **Appointments**: every appointment-lifecycle page (unallocated, allocated, ready-to-confirm, outcome-missing, RTA due, recently cancelled, calendar) reads one consolidated `appointments` table filtered by stage/status, not separate tables per page.
- **Activity Feed**: a real audit log (`activities` table) — mutating Server Actions call `src/lib/activity.ts`'s `logActivity()`.
