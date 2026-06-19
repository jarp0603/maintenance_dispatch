# Architecture Decision Record — Bluehost Migration

This file records major decisions made during the migration of the Maintenance
Dispatch application off Railway/Node hosting and onto Bluehost shared hosting.
Newest entries at the top. Each decision notes the context, the choice, and why.

---

## ADR-0005 — Self-host scheduling instead of Calendly
**Date:** 2026-06-18 · **Status:** Accepted

**Context:** The existing Express backend delegates tenant appointment scheduling
to the Calendly API. The brief requires self-hosted secure scheduling links,
double-booking prevention, link expiry/revocation, and forbids unnecessary paid
third-party services.

**Decision:** Replace Calendly with a self-hosted scheduling module in the PHP
API: `scheduling_links` (tokenized, expiring) + `appointments` tables, an
availability model, and server-side double-booking checks.

**Why:** Removes an external dependency and potential cost, keeps tenant data on
Bluehost, and satisfies the explicit feature requirements. Calendly code is kept
in the Node backend for reference until the PHP version is verified.

---

## ADR-0004 — Keep the Vite React SPA as the production frontend; retire the Next.js app
**Date:** 2026-06-18 · **Status:** Accepted

**Context:** The repo contains two frontends: (1) a Next.js 16 app at the repo
root (`src/`) using Supabase, and (2) a React 18 + Vite single-page app in
`client/`. Bluehost shared hosting cannot run a persistent Node server, so
Next.js SSR / server actions are not deployable there.

**Decision:** The `client/` Vite SPA becomes the production frontend. It builds to
static assets (`dist/`) that drop into `public_html` with an SPA-rewrite
`.htaccess`. The root Next.js app and its Supabase integration are treated as a
reference/abandoned scaffold and excluded from the production build (not deleted
yet).

**Why:** A static SPA is the only React option compatible with "no continuously
running Node.js server in production." It also matches "preserve existing design
and working features" — `client/` is the working, feature-complete UI.

---

## ADR-0003 — Build a new PHP API rather than port Node to Bluehost
**Date:** 2026-06-18 · **Status:** Accepted

**Context:** The brief mandates a PHP backend compatible with Bluehost shared
hosting and forbids a continuously running Node server. The current backend is
Node/Express.

**Decision:** Build a fresh PHP 8 REST API under `api/` (PDO/MySQL), reusing the
Node backend only as a behavioral reference. The Node backend stays in the repo
until the PHP API passes its endpoint tests.

**Why:** Shared hosting runs PHP under Apache per-request; it does not keep a Node
process alive. Porting business logic into PHP is required, not optional.

---

## ADR-0002 — Expand the database schema to the full domain model
**Date:** 2026-06-18 · **Status:** Accepted

**Context:** The Express backend uses a minimal SQLite/MySQL schema: a single
`work_orders` table plus `email_logs`, `settings`, `gmail_tokens`. There is no
users table (login is a single admin in env vars), no roles, and no separate
properties/tenants/units/appointments tables. The Next.js/Supabase scaffold has a
richer 13-table model but is being retired.

**Decision:** Author a new normalized MySQL schema covering users, roles,
properties, units, tenants, work orders, assignments, notes, status history,
appointments, scheduling links, attachments, email imports, and audit logs — as
required by the brief.

**Why:** The required features (roles, multi-technician assignment, status
history, tenant/property records, secure scheduling) cannot be built on the
single-table schema. The richer model also aligns with the retired Next.js app,
easing data mapping.

---

## ADR-0001 — Replace single-admin env login with a real users table + roles
**Date:** 2026-06-18 · **Status:** Accepted

**Context:** Current auth compares against one `ADMIN_USER` / `ADMIN_PASS_HASH`
in env and issues a 7-day JWT. The brief requires administrator and technician
roles with role-based authorization and a password-reset structure.

**Decision:** Move credentials into a `users` table (PHP `password_hash` /
`password_verify`), add a `roles` model, and enforce role-based access in PHP
middleware. Sessions use secure, HttpOnly cookies (with CSRF protection) rather
than localStorage-stored JWTs where practical.

**Why:** Multiple technicians and an administrator need distinct accounts and
permissions; env-based single login cannot express this. Cookie sessions reduce
token-theft surface compared to localStorage JWTs.
