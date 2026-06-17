# Maintenance Dispatch

A full-stack property maintenance dispatch web application for tracking work orders, scheduling tenant appointments, parsing maintenance request emails, and optimizing daily routes.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + React Router |
| Backend | Node.js + Express |
| Database | SQLite (dev) / MySQL (production) |
| Auth | JWT |
| Email | Gmail API (OAuth2) via googleapis |
| Scheduling | Calendly API v2 |
| Cron | node-cron |
| Routing | Google Maps Directions API (haversine fallback) |
| Charts | Recharts |

## Quick Start (Local Development)

### 1. Server

```bash
cd server
cp ../.env.example .env
# Fill in .env values (DB_TYPE=sqlite works out of the box)
npm install
npm run dev
```

Server runs on `http://localhost:3001`. Default login: **admin / admin123**.

### 2. Client

```bash
cd client
npm install
npm run dev
```

App opens at `http://localhost:5173`. The Vite dev server proxies `/api` to the Express server.

## Environment Variables

Copy `.env.example` to `server/.env` and configure:

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `DB_TYPE` | No | `sqlite` (default) or `mysql` |
| `GMAIL_CLIENT_ID` | For Gmail | Google OAuth2 client ID |
| `GMAIL_CLIENT_SECRET` | For Gmail | Google OAuth2 client secret |
| `CALENDLY_API_KEY` | For Calendly | Calendly personal access token |
| `CALENDLY_EVENT_URL` | For Calendly | Your Calendly event link |
| `GOOGLE_MAPS_API_KEY` | Optional | Enables real route directions |

## Features

### Dashboard
- Summary stat cards: open, scheduled today, completed this week, overdue
- Recent work orders table + Kanban pipeline view (toggle)
- Quick-add work order button

### Work Orders
- Full CRUD with filtering by status, priority, issue type, and search
- Issue types: electrical, smoke alarm, plumbing/ABS, welding, painting, door repair, HVAC, appliances, general
- Email history log per work order
- One-click send scheduling link to tenant

### Gmail Integration (Settings → Connect Gmail)
1. Create OAuth credentials at [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Gmail API, add scopes: `gmail.readonly` and `userinfo.email`
3. Set redirect URI: `http://localhost:3001/api/gmail/callback`
4. Click "Connect Gmail" in Settings
5. Use "Sync Now" to parse new maintenance emails into work orders

### Calendly Integration
1. Add your Calendly event URL in Settings
2. Set `CALENDLY_API_KEY` in `.env`
3. Configure webhook in Calendly dashboard pointing to `https://your-domain.com/api/calendly/webhook`
4. When a tenant books, the work order auto-updates to "scheduled"

### Automated Follow-ups (node-cron)
- 48h after creation: first follow-up email if still pending
- 96h after creation: second follow-up email
- 24h before appointment: reminder email
- After completion: completion confirmation email
- All timings configurable in Settings

### Route Planning
- Select a date to see all scheduled jobs
- Auto-orders stops (respects fixed times, minimizes travel)
- Shows travel time between stops
- Opens full route in Google Maps
- Printable route list

### Analytics
- Work orders over time (line chart, weekly/monthly)
- Issues by type (bar chart with completion overlay)
- Busiest days of the week
- Average resolution time by issue type
- Status distribution (pie chart)
- Top units by maintenance frequency

## Bluehost Deployment

### Frontend
1. Run `cd client && npm run build`
2. Upload `client/dist/` to `public_html/dispatch/` via FTP

### Backend (Node.js on Bluehost)
1. Upload `server/` to your home directory (e.g. `~/dispatch-server/`)
2. In cPanel → Setup Node.js App:
   - Node.js version: 18+
   - Application root: `dispatch-server`
   - Startup file: `app.js`
3. Set environment variables in cPanel Node.js App environment section
4. Set `DB_TYPE=mysql` and create a MySQL database in cPanel → MySQL Databases

### GitHub Actions CI/CD
Configure these secrets in your GitHub repository (Settings → Secrets):

| Secret | Description |
|---|---|
| `FTP_HOST` | Your Bluehost FTP hostname |
| `FTP_USERNAME` | FTP username |
| `FTP_PASSWORD` | FTP password |
| `VITE_API_BASE_URL` | Your production API URL |

Push to `main` to trigger automatic deployment.

## Project Structure

```
maintenance_dispatch/
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/     # Layout, modals, KanbanBoard, StatusBadge
│   │   ├── context/        # AuthContext
│   │   ├── lib/            # api.js (axios), constants.js
│   │   └── pages/          # Dashboard, WorkOrders, Schedule, RouteView, Analytics, Settings
│   └── package.json
├── server/                 # Node.js + Express backend
│   ├── db/                 # db.js (SQLite/MySQL abstraction), schema.sql
│   ├── middleware/         # auth.js (JWT)
│   ├── routes/             # workorders, gmail, calendly, routes, analytics, settings
│   ├── services/           # gmailParser, calendlyService, followupCron, routeOptimizer
│   └── app.js
├── .env.example
├── .github/workflows/
│   └── deploy.yml
└── README.md
```

## Default Credentials

- **Username:** `admin`
- **Password:** `admin123`

Change the password by generating a new bcrypt hash and setting `ADMIN_PASS_HASH` in `.env`:
```bash
node -e "console.log(require('bcryptjs').hashSync('yournewpassword', 10))"
```
