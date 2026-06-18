# Maintenance Dispatch

Maintenance Dispatch is a mobile-friendly work-order application deployed as a React frontend on Bluehost with an Express API on Railway and a MySQL database on Bluehost.

> Audit status: documentation reflects the repository and public deployment as reviewed on June 17, 2026. No production data, authenticated endpoints, hosting configuration, or deployed files were changed during the audit.

## Canonical application

| Layer | Location | Technology | Deployment |
| --- | --- | --- | --- |
| Frontend | `client/` | React 18, Vite 5, Tailwind CSS 3 | Bluehost at `/dispatch/` |
| API | `server/` | Node.js, Express 4, JWT | Railway |
| Database | `server/schema.sql` | MySQL in production; SQLite for isolated local startup | Bluehost |
| Deployment automation | `.github/workflows/` | GitHub Actions and FTP | Bluehost frontend only |

The root-level Next.js/Supabase application under `src/` and `supabase/` is an unfinished alternate implementation. It is not the production target and should not be configured or deployed without an explicit architecture decision.

## Current capabilities

The deployed client/API pair currently includes:

- Administrator login and JWT-authenticated API requests
- Dashboard statistics and work-order list, board, create, edit, and delete flows
- Status, priority, emergency flags, scheduling fields, notes, and basic history data
- Gmail import, Calendly integration, route generation, analytics, and settings endpoints
- Keyword-based email parsing that can support rule-based categorization

Several planned capabilities are incomplete or absent: role-based access, managed properties and units, tenants, technicians and assignments, reliable MySQL migrations, attachments, complete activity history, robust search/filtering, and production-safe backups and rollback.

## Important policy and safety notes

- This project must not use paid AI APIs. The audited API still registers a legacy Anthropic route; do not configure or use it. Removing that route is a priority functional change that requires approval after this documentation-only pull request.
- Never commit credentials or copy production values into `.env.example`.
- Do not expose server environment variables to Vite except intentionally public `VITE_*` build values.
- Do not run `server/schema.sql` manually against production without a verified backup and migration review.
- There are unsafe development credential fallbacks in the current server. They are documented as a security finding, not as supported configuration.

## Local development

Prerequisites: a current Node.js LTS release and npm.

### API

```bash
cd server
npm ci
cp ../.env.example .env
npm run dev
```

The example defaults to an isolated local SQLite database. Replace every `replace-with-*` value before testing authentication or integrations. Do not point local development at the production MySQL database.

### Frontend

```bash
cd client
npm ci
VITE_API_URL=http://localhost:3001 npm run dev
```

For PowerShell:

```powershell
Set-Location client
npm.cmd ci
$env:VITE_API_URL = "http://localhost:3001"
npm.cmd run dev
```

## Validation baseline

The audit established this baseline without connecting to production data:

- `client` production build: passes, with a bundle-size warning
- isolated `server` startup and `/api/health`: passes with SQLite and placeholder values
- lint: fails with existing errors in active and unused frontend code
- root Next.js build: fails because two imported UI packages are undeclared
- unit assertions: 13 pass, but the root command also discovers dependency tests and exits unsuccessfully
- database tests: require a local Supabase/Postgres service and do not currently run in a clean checkout

See the audit details and recommended order of work in [docs/HANDOFF.md](docs/HANDOFF.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Deployment and rollback](docs/DEPLOYMENT.md)
- [Audit findings and development plan](docs/HANDOFF.md)

No functional changes or deployments should begin until the documentation pull request is reviewed and approved.
