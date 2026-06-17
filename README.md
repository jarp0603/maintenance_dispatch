# Maintenance Dispatch

Private dispatch web app for importing maintenance work orders from Gmail, scheduling
tenant appointments via Calendly, and tracking each work order through its full lifecycle.

This is a single-operator internal tool, not a public product. It is built and run by
one developer/maintainer.

## Stack

- Next.js (App Router) + TypeScript (strict mode)
- Supabase (Postgres, Auth, Row Level Security)
- Tailwind CSS + shadcn/ui
- Gmail API (Google OAuth)
- Calendly API + webhooks
- Zod for runtime validation
- Vitest for tests

## Getting started

This project runs entirely against a **local** Supabase stack (Postgres, Auth, Storage)
via Docker -- no cloud Supabase project is needed yet. It will be migrated to a hosted
project later, once the app is fully working.

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) running.

```bash
npm install
npm run db:start             # starts local Postgres/Auth/Storage via Docker
cp .env.example .env.local   # .env.local already has working local-dev defaults checked in
npm run dev
```

Open http://localhost:3000. Supabase Studio (local DB browser) is at http://127.0.0.1:54323.

## Scripts

| Command                | Purpose                                        |
| ----------------------- | ----------------------------------------------- |
| `npm run dev`           | Start the local dev server                       |
| `npm run build`         | Production build                                 |
| `npm run start`         | Run the production build                         |
| `npm run typecheck`     | TypeScript type checking (no emit)               |
| `npm run lint`          | ESLint                                           |
| `npm run format`        | Prettier — write                                 |
| `npm run format:check`  | Prettier — check only                            |
| `npm test`              | Run the unit test suite once                     |
| `npm run test:watch`    | Run the unit test suite in watch mode            |
| `npm run test:db`       | Run RLS/constraint integration tests (needs local DB running) |
| `npm run db:start`      | Start the local Supabase stack (Docker)          |
| `npm run db:stop`       | Stop the local Supabase stack                    |
| `npm run db:status`     | Show local connection URLs and keys              |
| `npm run db:reset`      | Drop and re-apply all migrations from scratch     |

## Environment variables

See [.env.example](./.env.example) for the full list, grouped by the phase that
introduces them. Required variables are validated centrally:

- [src/lib/env.server.ts](./src/lib/env.server.ts) — server-only secrets (never sent to the browser)
- [src/lib/env.client.ts](./src/lib/env.client.ts) — `NEXT_PUBLIC_*` variables safe for the browser

## Database

Migrations live in [supabase/migrations](./supabase/migrations), applied in filename
order. All 13 tables have Row Level Security enabled. Two access patterns:

- **Owner-scoped tables** (profiles, properties, tenants, work_orders, status_history,
  appointments, communications) — RLS policy `owner_id = auth.uid()`, granted to both
  `authenticated` and `service_role`. The operator's own session can read/write their
  own data directly; background jobs use `service_role` (which bypasses RLS) and must
  filter by `owner_id` themselves.
- **Service-role-only tables** (integration_credentials, public_action_tokens,
  webhook_events) — no policies, and table grants are explicitly revoked from
  `authenticated`/`anon`. These hold OAuth tokens, public-link token hashes, and raw
  webhook payloads; only trusted server code (never the browser) touches them.
  (email_imports, ratings, work_order_attachments are a middle case: written by
  service-role background jobs, read-only for the operator.)

Note: recent Supabase versions no longer auto-expose newly created tables to the API
roles -- every table's migration includes explicit `grant`/`revoke` statements. If you
add a new table, you must grant it explicitly or `authenticated`/`service_role` will get
a permission error before RLS is even evaluated.

Run `npm run test:db` to verify RLS isolation and constraints against a live database.

## Security notes

- Service-role Supabase credentials, OAuth client secrets, and webhook signing keys are
  server-only and validated through `env.server.ts`. They are never imported into
  client components.
- Public tenant-facing links use opaque random tokens (Phase 10), never raw database IDs.
- Row Level Security is enabled on every table holding tenant or work-order data
  (Phase 2); authenticated users can only see their own records.

## Project status

This project is built incrementally, phase by phase, with verification (typecheck,
lint, tests, build) after each phase before moving to the next. See commit history
for progress.
