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

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command                | Purpose                            |
| ---------------------- | ---------------------------------- |
| `npm run dev`          | Start the local dev server         |
| `npm run build`        | Production build                   |
| `npm run start`        | Run the production build           |
| `npm run typecheck`    | TypeScript type checking (no emit) |
| `npm run lint`         | ESLint                             |
| `npm run format`       | Prettier — write                   |
| `npm run format:check` | Prettier — check only              |
| `npm test`             | Run the test suite once            |
| `npm run test:watch`   | Run the test suite in watch mode   |

## Environment variables

See [.env.example](./.env.example) for the full list, grouped by the phase that
introduces them. Required variables are validated centrally:

- [src/lib/env.server.ts](./src/lib/env.server.ts) — server-only secrets (never sent to the browser)
- [src/lib/env.client.ts](./src/lib/env.client.ts) — `NEXT_PUBLIC_*` variables safe for the browser

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
