# Bluehost Migration Plan — Maintenance Dispatch

**Status:** Living document · **Branch:** `bluehost-migration` · **Last updated:** 2026-06-18

This document records (A) the current architecture as audited, and (B) the plan
to move the application onto Bluehost shared hosting with a PHP + MySQL backend
and a static React frontend, removing all Railway/Node-server dependencies.

---

## Part A — Current Architecture (audit findings)

The repository currently contains **two parallel, overlapping applications** plus
shared tooling. This is the single most important fact for the migration.

### A.1 App #1 — Next.js + Supabase (repo root, being retired)

- **Location:** `src/` (App Router), `supabase/`, root `package.json`.
- **Stack:** Next.js 16, React 19, TypeScript, Tailwind, shadcn/ui, Zod, Vitest.
- **Data:** Supabase (hosted Postgres) with Row-Level Security; a 13-table model
  migrated in commits "Phase 1–3" (properties, tenants, units, work orders,
  status history, etc.).
- **Auth:** Supabase Auth, protected dashboard, server actions / DAL in
  `src/lib/auth/`.
- **Verdict:** **Not Bluehost-compatible.** Next.js needs a persistent Node
  runtime for SSR/server actions, and Supabase is an external hosted service.
  Retire for production (keep as reference; do not delete yet).

### A.2 App #2 — React (Vite) + Express (the working MVP)

This is the feature-complete app described in `README.md` and is the basis for
the migration.

**Frontend — `client/`**
- **Stack:** React 18, Vite, React Router, Tailwind, `sonner` toasts, `axios`,
  Recharts.
- **Pages:** `Login`, `Dashboard`, `WorkOrders`, `WorkOrderDetail`, `Schedule`,
  `RouteView`, `Analytics`, `Settings`. Routing in `App.jsx` with a
  `ProtectedRoute` guard backed by `AuthContext`.
- **API layer:** `client/src/lib/api.js` — a single axios instance. Base URL from
  `VITE_API_BASE_URL` (falls back to relative `/api` via the Vite dev proxy).
  JWT is read from `localStorage` (`dispatch_token`) and attached as a Bearer
  header; a 401 interceptor clears the token and redirects to `/login`.
- **Build output:** static `dist/` — **Bluehost-compatible.** This is the
  frontend we keep.

**Backend — `server/` (Node/Express, to be replaced by PHP)**
- **Entry:** `app.js` — Express, CORS (origin = `APP_URL`), morgan, JSON body,
  `express-rate-limit` (200 req / 15 min on `/api`), starts cron on boot.
- **DB abstraction:** `db/db.js` supports `sqlite` (better-sqlite3, default dev)
  and `mysql` (mysql2 pool). Schema in `db/schema.sql`.
- **Routes & endpoints** (all under `/api`):

  | Router | Auth | Endpoints |
  |---|---|---|
  | `auth` | partial | `POST /login`, `GET /me` (auth) |
  | `workorders` | `router.use(requireAuth)` | `GET /stats`, `GET /`, `GET /kanban`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`, `POST /:id/send-scheduling` |
  | `gmail` | per-route | `GET /auth-url`, `GET /callback` (public), `GET /status`, `DELETE /disconnect`, `POST /sync` |
  | `calendly` | partial | `GET /status` (auth), `POST /webhook` (public, raw body) |
  | `routes` | `router.use(requireAuth)` | `GET /`, `POST /optimize` |
  | `analytics` | `router.use(requireAuth)` | `GET /overview`, `/trends`, `/by-type`, `/resolution-time`, `/by-day`, `/by-unit` |
  | `settings` | `router.use(requireAuth)` | `GET /`, `PUT /` |

- **Services:** `gmailParser.js` (parse maintenance-request emails),
  `calendlyService.js` (scheduling links + appointment sync),
  `routeOptimizer.js` (Google Maps Directions with haversine fallback),
  `followupCron.js` (node-cron: follow-ups, reminders, completion emails).

### A.3 Authentication (current)

- **Single admin** identity: `ADMIN_USER` + `ADMIN_PASS_HASH` in env (default
  `admin` / `admin123`). No users table, **no roles**, no per-user accounts.
- JWT (`jsonwebtoken`, HS256, 7-day expiry, secret `JWT_SECRET`). Token stored in
  browser `localStorage`. `requireAuth` middleware validates the Bearer token.
- **Gaps vs. brief:** no technician role, no role-based authorization, no
  password-reset flow, no logout endpoint (client just drops the token), JWT in
  localStorage is XSS-exposed.

### A.4 Database schema (current)

`server/db/schema.sql` defines only four tables: `work_orders` (denormalized —
tenant name/email/unit/address are columns, no FK), `email_logs`, `settings`
(key/value), `gmail_tokens`. **No** users, roles, properties, units, tenants,
assignments, notes, status-history, appointments, scheduling-links, attachments,
or audit-log tables. Statuses are free-text in a single column.

### A.5 Environment variables (current)

From `.env.example`: `PORT`, `NODE_ENV`, `JWT_SECRET`, `APP_URL`, `ADMIN_USER`,
`ADMIN_PASS_HASH`, `DB_TYPE`/`DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`/`DB_PORT`,
`GMAIL_CLIENT_ID`/`SECRET`/`REDIRECT_URI`/`USER_EMAIL`, `CALENDLY_API_KEY`/
`EVENT_URL`/`WEBHOOK_SECRET`, `GOOGLE_MAPS_API_KEY`, follow-up timing vars, and
legacy Supabase vars. `.gitignore` correctly excludes `.env*` (keeps
`.env.example`) and `server/.env`.

### A.6 Integrations

- **Gmail OAuth2** (`googleapis`): import maintenance-request emails into work
  orders. Redirect URI is currently localhost. **Free tier** for read + send at
  this volume.
- **Google Maps Directions/Geocoding** (optional): route optimization, with a
  free haversine fallback if no key. **Billable** if enabled at scale — flag.
- **Calendly API v2**: tenant scheduling — to be replaced (see ADR-0005).
- **Email sending** via `nodemailer` (Gmail SMTP) for follow-ups/reminders.

### A.7 Railway / hosting dependencies

- **No Railway config files** (`railway.json`, `railway.toml`, Procfile) exist in
  the repo. The only Railway reference is a code comment in
  `client/src/lib/api.js` describing the prod split (frontend on Bluehost, API on
  Railway). **Removing Railway is therefore mostly conceptual** — there is no
  infra file to delete, only the assumption that the API runs on a Node host.
  The real work is replacing the Node API with PHP. The comment will be updated.

### A.8 Security findings (to address in PHP build)

1. Default credentials `admin` / `admin123` baked into code as a fallback.
2. JWT secret has an insecure default (`dev_secret_change_in_production`).
3. JWT stored in `localStorage` (XSS-exposed) — move to HttpOnly cookie + CSRF.
4. No roles / role-based authorization.
5. No CSRF protection (token auth today, but cookie sessions will need it).
6. Gmail `/callback` is public (expected for OAuth) — must validate `state`.
7. No file-upload feature yet — attachments must enforce type/size limits,
   randomized names, and a protected upload directory.
8. No login-attempt lockout (only a coarse global rate limiter).

### A.9 Broken / mocked / unfinished vs. the brief

- No file/photo uploads anywhere (brief requires work-order photos/documents).
- No tenants/properties CRUD in the working app (only embedded text fields).
- No status-history persistence (brief requires it).
- No self-hosted scheduling (depends on Calendly).
- No password reset, logout endpoint, or multi-user accounts.
- `server/probe.js` is an untracked ad-hoc debug script (ignore/remove).

---

## Part B — Target Architecture & Migration Plan

### B.1 Target production topology (Bluehost)

```
public_html/
├── index.html, assets/      # React (Vite) static build from client/dist
├── .htaccess                # SPA rewrites + security headers; routes /api to PHP
└── api/                     # PHP 8 REST API (PDO/MySQL)
    ├── index.php            # front controller / router
    ├── .htaccess            # routes all /api/* to index.php
    ├── config/  controllers/  middleware/  models/  routes/  services/  utils/
    └── uploads/             # protected; randomized filenames; deny direct exec
# Outside public_html (preferred when allowed):
config/secrets.php or .env   # DB creds, OAuth secrets — not web-accessible
```

Scheduled work (follow-ups, reminders) moves from `node-cron` to **Bluehost cron
jobs** invoking a PHP CLI script (e.g. `php /home/user/.../api/cli/cron.php`).

### B.2 Migration phases (ordered, per brief)

1. **Inspect** the existing app. — ✅ done (Part A).
2. **Document** current architecture + plan. — ✅ this document.
3. **MySQL schema** — `database/schema.sql`, `sample_data.sql` (fictional),
   `migrations/`, indexes, FKs. — *in progress this phase.*
4. **Build the PHP API** — auth (sessions + roles), work orders, tenants,
   properties, scheduling links, appointments, attachments, analytics, Gmail
   OAuth, settings. Mirror/upgrade the Node endpoints.
5. **Connect the React frontend** — point `client/src/lib/api.js` at the PHP API
   via centralized config; adapt auth (cookie session vs. localStorage JWT);
   add file-upload UI, tenants/properties views, status history.
6. **Test locally** — PHP built-in server + local MySQL; endpoint test scripts;
   the existing Vitest suite for the client.
7. **Prepare Bluehost deploy files** — `.htaccess` files, build script, env
   template, cron command, `docs/BLUEHOST_DEPLOYMENT.md`.
8. **Deploy to staging** (subdomain) on Bluehost and test end-to-end.
9. **Migrate production data** into MySQL.
10. **Verify backups** (DB + uploads).
11. **Only then** provide instructions for disabling Railway/Node. *We never
    disable it ourselves.*

### B.3 Endpoint mapping (Node → PHP, REST)

| Feature | Node (current) | PHP (target) |
|---|---|---|
| Login | `POST /api/auth/login` | `POST /api/auth/login` |
| Logout | _(client-side only)_ | `POST /api/auth/logout` |
| Current user | `GET /api/auth/me` | `GET /api/auth/me` |
| Password reset | _(none)_ | `POST /api/auth/forgot`, `POST /api/auth/reset` |
| Work orders | `GET/POST /api/workorders`, `GET/PUT/DELETE /:id` | `GET/POST /api/work-orders`, `GET/PUT /:id`, `POST /:id/complete`, archive via PATCH |
| WO stats/kanban | `GET /api/workorders/stats|kanban` | `GET /api/work-orders/stats|board` |
| Tenants | _(none)_ | `GET/POST /api/tenants`, `GET/PUT /:id` |
| Properties | _(none)_ | `GET/POST /api/properties`, units nested |
| Scheduling link | `POST /api/workorders/:id/send-scheduling` | `POST /api/scheduling-links`, public `GET /schedule/:token`, `POST /api/appointments` |
| Attachments | _(none)_ | `POST /api/work-orders/:id/attachments`, `GET /:id` |
| Analytics | `GET /api/analytics/*` | same paths |
| Routes | `GET /api/routes`, `POST /optimize` | same paths |
| Gmail | `GET /api/gmail/*` | same paths, prod callback URL |
| Settings | `GET/PUT /api/settings` | same paths |

Endpoint names will be kept consistent and documented as they are built.

### B.4 Security plan (PHP)

PDO prepared statements everywhere; `password_hash`/`password_verify`;
HttpOnly + Secure + SameSite session cookies; CSRF tokens on state-changing
requests; server-side input validation + output escaping; role-based
authorization (admin/technician); upload type+size limits with randomized names
in a protected directory; login-attempt throttling; strict CORS; and error
handling that never leaks SQL or credentials.

### B.5 Cost guardrails

No new paid services. Gmail API stays on the free tier (read/send at this
volume). Google Maps Directions is **billable** and remains optional behind the
haversine fallback — it will not be enabled without explicit confirmation.
Calendly (potential cost / external dependency) is removed in favor of
self-hosted scheduling.

### B.6 Open items needing the user (later, not blocking now)

- **GitHub:** push access to `github.com/jarp0603/maintenance_dispatch` to publish
  the `bluehost-migration` branch (currently local). Needed at end of Phase 3+.
- **Bluehost:** cPanel access details (or willingness to run provided steps) for
  staging subdomain, MySQL DB creation, and cron setup. Needed at Phase 8.
- No passwords/secrets should be shared in chat — deployment uses `.env` created
  directly on the server per `BLUEHOST_DEPLOYMENT.md`.

---

## Assumptions made (documented per working rules)

1. The `client/` Vite SPA — not the Next.js app — is the production frontend.
2. A new PHP API replaces the Node backend; Node stays until PHP is verified.
3. The full normalized schema (Part B.3 tables) is authoritative going forward.
4. Self-hosted scheduling replaces Calendly.
5. Google Maps stays optional/off to avoid billing; Gmail stays free-tier.
