# Maintenance Dispatch — PHP API

PHP 8 REST API for Bluehost shared hosting. PDO/MySQL, session-based auth with
roles, CSRF protection, and self-hosted scheduling. No Node server, no Railway.

## Layout

```
api/
├── index.php          # front controller (autoloader, CORS, dispatch)
├── .htaccess          # routes /api/* -> index.php + security headers
├── .env.example       # copy to .env (keep .env out of git / web root)
├── config/Config.php  # .env loader + config accessor
├── utils/             # Database (PDO), Router, Request, Response, Validator
├── middleware/        # Auth (sessions/roles), Csrf, RateLimiter
├── models/            # User, WorkOrder, Tenant, Property, Appointment, ...
├── controllers/       # one per resource
├── services/          # FollowupService (cron work)
├── routes/routes.php  # the route table
├── cli/cron.php       # Bluehost cron entry point
├── tests/smoke.sh     # curl-based endpoint smoke test
└── uploads/           # protected; randomized filenames; deny direct access
```

## Local development

Requires PHP 8.1+ and a local MySQL (or MariaDB).

```bash
# 1. Create a local DB and import the schema + sample data
mysql -u root -p -e "CREATE DATABASE maintenance_dispatch CHARACTER SET utf8mb4"
mysql -u root -p maintenance_dispatch < ../database/schema.sql
mysql -u root -p maintenance_dispatch < ../database/sample_data.sql

# 2. Configure the API
cp .env.example .env
#   set APP_ENV=development, DB_* to your local values,
#   APP_URL=http://localhost:5173

# 3. Run the API (built-in server). Route /api to index.php:
php -S localhost:8000 router.php   # see note below
```

Because the built-in server has no Apache rewrites, use a tiny `router.php`
that forwards `/api/*` to `index.php`, or run behind Apache locally. A sample
`router.php` is included for `php -S`.

Sample users (from `database/sample_data.sql`) log in with password
`ChangeMe123!` — **change or remove these before any real deployment.**

## Testing

```bash
BASE=http://localhost:8000 USER=admin PASS='ChangeMe123!' ./tests/smoke.sh
```

Covers: unauthenticated rejection, login + session cookie, `/auth/me`, CSRF
enforcement, authenticated create, and bad-password rejection.

## Security summary

PDO prepared statements everywhere · `password_hash`/`password_verify` ·
HttpOnly + SameSite (Secure in prod) session cookies · CSRF token on all
state-changing requests · server-side validation · role-based authorization
(administrator/technician; technicians are scoped to their own work orders) ·
upload type+size limits with randomized names in a deny-all directory ·
login-attempt throttling · strict single-origin CORS · errors never expose SQL
or credentials.

See `../docs/BLUEHOST_DEPLOYMENT.md` (added in the deployment phase) for cPanel
setup, cron jobs, and HTTPS.
