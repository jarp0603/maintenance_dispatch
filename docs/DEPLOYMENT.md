# Deployment, Backup, and Rollback

This is a runbook for the current Bluehost frontend, Railway API, and Bluehost MySQL arrangement. It documents the process; it does not authorize a deployment. All deployment steps require review and approval.

## Environment ownership

| Value | Location | Visibility |
| --- | --- | --- |
| `VITE_API_URL` | GitHub Actions build environment | Public in compiled JavaScript |
| `APP_URL` | Railway | Server-only; exact Bluehost frontend origin, without a path or trailing slash unless code is updated |
| JWT and administrator values | Railway | Server-only secrets |
| MySQL connection values | Railway | Server-only secrets |
| Gmail, Calendly, maps, and email values | Railway | Server-only secrets |
| `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD` | GitHub Actions secrets | Repository secret store only |

Never paste secret values into issues, pull requests, logs, workflow YAML, frontend variables, or `.env.example`.

## Frontend: Bluehost `/dispatch/`

The active workflow is `.github/workflows/deploy-bluehost.yml`. A push to `main` that changes `client/**` currently triggers:

1. Node setup and `npm ci` in `client/`.
2. A Vite production build with the Railway API URL and `/dispatch/` base path.
3. FTP upload of `client/dist/` to the Bluehost `/dispatch/` directory.

The included `client/public/.htaccess` is copied into the build to provide single-page-application routing.

### Pre-deployment checks

Run from a clean checkout using placeholders and a non-production API target:

```bash
cd client
npm ci
npm run lint
VITE_API_URL=https://api-staging.example.invalid npm run build
```

Lint currently fails and must be repaired before it becomes a release gate. The build passes with a bundle-size warning. Also verify that every absolute asset, including the favicon, resolves beneath `/dispatch/`.

### Safer release procedure

Before changing the existing workflow:

1. Record the deployed Git commit and download a timestamped copy of the current `/dispatch/` directory to approved secure storage.
2. Build once in CI and retain the exact artifact that was reviewed.
3. Prefer uploading to a versioned release directory and switching the served directory only after verification; the current FTP upload is not atomic.
4. Smoke-test the login page, mobile width, static assets, browser console, and API health without authenticating to production.
5. Retain at least the immediately previous frontend artifact for rollback.

### Frontend rollback

Restore the last known-good artifact to `/dispatch/`, verify `.htaccess`, then repeat the public smoke test. Do not overwrite WordPress or any directory outside the application deployment path.

## API: Railway

No `railway.json`, `railway.toml`, Dockerfile, or Procfile is committed. Railway therefore depends on dashboard configuration that is not reproducible from this repository.

The intended service settings are:

- Root directory: `server`
- Install: `npm ci`
- Start: `npm start`
- Health endpoint: `/api/health`
- Production database adapter: `DB_TYPE=mysql`
- Frontend CORS origin: `APP_URL` set to the exact Bluehost origin

Required variable names are documented in `.env.example`; production values must exist only in Railway. Do not configure any paid AI provider key.

### API pre-deployment checks

1. Install server dependencies from the lockfile.
2. Run automated tests against an isolated test database.
3. Start the server with placeholder values and SQLite; verify `/api/health`.
4. Validate proposed MySQL migrations against a separate staging MySQL database with the same major version as production.
5. Review the diff and dependency audit. Do not use an automatic force-fix on production branches.

### API rollback

Use Railway's deployment history to redeploy the previously verified commit. Confirm health and CORS before authenticated testing. A code rollback does not reverse database changes; database migrations need an explicit, separately reviewed rollback or forward-fix plan.

## MySQL schema management

The present startup-time schema initialization is not safe enough for evolving production data. Before adding product tables or columns:

1. Create a dedicated, versioned MySQL migration directory and a migration history table.
2. Make each migration narrowly scoped, repeatable where practical, and explicit about irreversible operations.
3. Test it against a disposable staging copy with sanitized data.
4. Back up only the maintenance application database using Bluehost's supported backup/export tooling or `mysqldump` with credentials supplied interactively or through protected environment configuration.
5. Verify the backup can be restored into a separate database before applying a production migration.
6. Record row counts and schema version before and after migration.
7. Never run migration tooling against a WordPress database or another Bluehost schema.

For destructive changes, use an expand-and-contract sequence: add new structures, deploy compatible code, copy and verify data, then remove obsolete structures in a later approved release. Avoid dropping or rewriting live data in the same release that introduces its replacement.

## Backup schedule recommendation

- Database: automated daily backup plus an on-demand backup before every migration; retention appropriate to business requirements.
- Frontend: retain versioned build artifacts and the prior deployed directory.
- API: rely on immutable Git commits and Railway deployment history, with configuration variable names documented separately from their secret values.
- Recovery exercise: periodically restore a database backup into an isolated environment and run a documented smoke test.

The owner should confirm Bluehost and Railway retention capabilities before treating provider backups as sufficient.

## Release approval checklist

- Pull request reviewed; no direct merge to the default branch
- No secrets or production data in the diff or logs
- No paid AI API or provider key added
- Lint, relevant tests, and builds pass
- Database migration reviewed and staging-tested, if applicable
- Backup and rollback owner identified
- Bluehost path, Railway service, and database target independently confirmed
- Post-release smoke test and rollback threshold agreed in advance
