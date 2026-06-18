# Project Audit and Handoff

Audit date: June 17, 2026

Scope: repository contents, dependency installation, static analysis, available automated tests, isolated builds/startup, public frontend behavior, public API health, and CORS. The audit did not authenticate to production, query the production database, change a provider setting, deploy, or run a destructive migration.

## Executive summary

The public login page and API health endpoint are available, the active React frontend builds, and the Express API starts in an isolated SQLite configuration. The repository nevertheless has two competing application architectures, broken quality gates, production-MySQL incompatibilities, and several high-priority authentication and integration risks.

The safest direction is to keep the already deployed `client/` + `server/` + MySQL stack as the canonical product, harden it incrementally, and leave the root Next.js/Supabase experiment untouched until its useful pieces can be evaluated. Existing working behavior should be preserved behind regression tests before structural changes.

## Audit coverage

Reviewed:

- README and documentation files
- Root, client, and server manifests and lockfiles
- Active and alternate frontend source trees
- Express server, middleware, services, API routes, schema, and test files
- Supabase migrations and root database tests
- `.htaccess`, GitHub Actions workflows, environment example, ignore rules, and available deployment configuration
- Recent branch history and divergence between `main` and `dev`

Public, read-only checks confirmed:

- Bluehost serves the login application at `/dispatch/`.
- The page is usable at a 390-pixel mobile viewport with no observed horizontal overflow.
- Static JavaScript and CSS load without observed browser console errors.
- The favicon URL currently points outside `/dispatch/` and does not match a built asset.
- Railway `/api/health` responds successfully.
- CORS accepts the expected Bluehost origin with credentials enabled.

No authenticated or database-backed production endpoint was called.

## Validation results

| Check | Result | Notes |
| --- | --- | --- |
| Root `npm ci` | Pass | Dependency advisories remain |
| Client `npm ci` | Pass | Dependency advisories remain |
| Server `npm ci` | Pass | Dependency advisories remain |
| Client lint | Fail | 38 errors and 8 warnings across active and inactive client code |
| Root type check | Fail | Missing declared packages for `next-themes` and `sonner` imports |
| Root unit command | Fail overall | 13 project assertions pass; Vitest also discovers nested dependency tests |
| Root database tests | Fail | Local Supabase/Postgres service is absent; cleanup also assumes a client was created |
| Client production build | Pass with warning | JavaScript bundle is about 605 KB before gzip and exceeds Vite's warning threshold |
| Root Next.js build | Fail | Undeclared UI imports prevent compilation |
| Isolated API startup | Pass | SQLite, placeholder values, no production connection; health returned successfully |

Dependency audit reports include direct or transitive advisories affecting Vite/esbuild in the client, Next/PostCSS in the root experiment, and Nodemailer/Google client dependencies in the server. Upgrades should be reviewed and tested rather than applied with a force-fix.

## Existing feature inventory

| Area | Status | Audit observation |
| --- | --- | --- |
| Login | Partial | Single administrator JWT flow; no roles or persistent users |
| Dashboard | Present | Statistics and work-order views exist |
| Work-order CRUD | Present | Create, view, edit, delete, status, priority, emergency, scheduling, notes |
| Properties and units | Partial | Stored as flat address/unit fields; no managed entities |
| Tenants | Partial | Contact fields live on work orders; no tenant records |
| Technicians | Incomplete | UI uses hardcoded examples; assignment is not persisted |
| Search and filters | Partial | Basic views exist; not a complete indexed/filterable workflow |
| Routes | Partial | Route endpoint and UI exist; depot/coordinate behavior includes hardcoded or synthetic data |
| Work history | Partial | Fields and status data exist; activity view is incomplete |
| Attachments | Missing | No production MySQL table or active upload flow |
| Gmail import | Incomplete | Response contract differs between active UI and API; sync refresh behavior is unreliable |
| Calendly | Partial | Integration exists but webhook verification can fail open |
| Categorization | Conflicted | Keyword parser exists, but a prohibited paid-AI route is also active |
| Backups and migrations | Incomplete | No versioned MySQL migrations or committed recovery automation |

## Findings by priority

### P0 - address before feature development

1. **Paid AI policy violation.** `server/routes/ai.js` invokes Anthropic and is registered at `/api/ai`. Do not supply a key or call it. Remove the route and dependency surface after approval, replacing needed behavior with deterministic rules.
2. **Unsafe authentication fallbacks.** The server contains built-in fallback administrator and JWT values. Production should fail closed when strong environment configuration is missing, and existing credentials should be rotated outside the repository.
3. **MySQL query incompatibility and unversioned initialization.** Settings, analytics, and scheduled queries contain SQLite syntax while production uses MySQL. Automatic schema execution at startup is not a safe migration mechanism.
4. **OAuth and webhook validation gaps.** Gmail OAuth lacks a verified `state` round trip; callback errors and request logging can disclose sensitive query data. Calendly verification accepts unsigned webhooks if its secret is absent.

### P1 - security and reliability foundation

1. Add persistent users, password hashes, roles, authorization checks, short-lived access tokens, and a revocation/refresh strategy.
2. Move OAuth token storage to encrypted-at-rest application storage or a provider secret mechanism; never log authorization codes or tokens.
3. Add a strict login rate limit, safer error responses, input validation, and output/HTML escaping for user-controlled email fields.
4. Configure and verify encrypted MySQL transport where the provider supports it.
5. Create versioned MySQL migrations, an isolated integration-test database, backup verification, and rollback procedures.
6. Repair CI discovery and lint/type/build gates; upgrade vulnerable dependencies through reviewed releases.

### P2 - product correctness

1. Normalize properties, units, tenants, technicians, assignments, notes/history, and attachments in MySQL.
2. Reconcile frontend/API contracts, especially technician assignment, Gmail sync counts, categorization values, and create-error behavior.
3. Replace hardcoded technician, depot, and generated-coordinate data with managed records and validated geocoding.
4. Complete activity/history, search/filtering, attachment upload limits, file-type checks, and authorization.
5. Preserve current work-order behavior with API and browser regression tests before splitting the large active `App.jsx`.

### P3 - operations and maintainability

1. Commit Railway service configuration and pin a supported Node runtime after validation.
2. Make frontend delivery artifact-based and reversible instead of an in-place non-atomic FTP update.
3. Fix asset base paths and reduce/split the large frontend bundle.
4. Decide whether to archive the unused client router implementation and root Next/Supabase application after comparing any unique value they contain.
5. Reconcile or close the divergent `dev` branch rather than merging it blindly; its unique change targets an inactive API helper and a differently named environment variable.

## Security observations

- JWTs are stored in `localStorage`, increasing exposure if a script injection occurs.
- Authentication is identity-only and administrator-only; there is no role-based authorization.
- Generic error handling can return internal error messages to clients.
- Gmail callback data can reach access logs, and token records are stored as plaintext database fields.
- User-controlled fields are interpolated into HTML email templates without systematic escaping.
- The global rate limiter is not a substitute for a tight login-specific limiter.
- Webhook verification depends on optional configuration and can fail open.
- No actual provider token, password, cookie, or private key was found in the tracked files by the audit's location-only secret scan. That does not replace repository secret scanning or credential rotation.

## Unused, duplicated, or ambiguous areas

- `client/src/App.jsx` is the mounted production client, while the router/pages/context tree is not reached from `main.jsx`.
- Root `src/` and `supabase/` form a separate Next.js/Postgres product that is not deployed and does not build cleanly.
- `.github/workflows/deploy.yml` is disabled; `deploy-bluehost.yml` is the active frontend workflow.
- No committed Railway configuration exists.
- The schema and adapters attempt to support both MySQL and SQLite, but SQL is not consistently portable.

Do not delete these areas in the documentation pull request. First add tests around active behavior, then propose archival or consolidation in a separate reviewed change.

## Proposed development plan

### Phase 0: containment and decisions

- Confirm `client/` + `server/` + MySQL as the canonical production stack.
- Remove the paid-AI route and any provider-specific dependency after approval.
- Eliminate credential fallbacks, rotate production secrets through providers, and make missing security configuration fail closed.
- Fix OAuth state/logging and mandatory webhook signature verification.
- Establish verified database and frontend backups.

### Phase 1: tested platform foundation

- Repair lint, type, Vitest discovery, and database test setup.
- Introduce versioned, MySQL-native migrations and staging validation.
- Add users, roles, and authorization with administrator, dispatcher, and technician permissions.
- Add API validation, safe errors, audit logging, and integration security tests.

### Phase 2: core dispatch model

- Add normalized properties, units, tenants, technicians, and assignment/scheduling tables.
- Migrate existing flat work-order data with reversible, staged migrations.
- Complete work-order editing, status transitions, priority/emergency rules, search, filters, notes, and history.
- Replace hardcoded routing inputs with managed data.

### Phase 3: files and communications

- Add private photo/document attachment storage with size/type controls and authorization.
- Repair Gmail import contracts and idempotency.
- Harden outbound email rendering and communication history.

### Phase 4: deterministic categorization

- Define an ordered rule set using sender, subject, body keywords, property/unit patterns, urgency phrases, and exclusions.
- Store rule version and explanation with each classification.
- Add fixtures for ambiguous, emergency, pest, plumbing, electrical, HVAC, and uncategorized messages.
- Provide dispatcher override and feedback without calling an AI service.

### Phase 5: release engineering

- Commit reviewed Railway configuration and supported runtime versions.
- Add staging, artifact retention, smoke tests, migration checks, and rollback gates.
- Run a documented restore exercise before relying on the backup plan.
- Deploy only after owner approval of a dedicated release pull request.

## Approval gate

This audit branch contains documentation and a placeholder-only environment template. It intentionally makes no functional change. Stop here until the owner approves the audit and selects the first implementation phase.
