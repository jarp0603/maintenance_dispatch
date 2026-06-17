-- Maintenance Dispatch Database Schema
-- Compatible with both MySQL and SQLite (via db.js abstraction)

CREATE TABLE IF NOT EXISTS work_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_name TEXT NOT NULL,
  unit_number TEXT NOT NULL,
  address TEXT NOT NULL,
  issue_type TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  scheduled_date DATE,
  scheduled_time TEXT,
  notes TEXT,
  source TEXT DEFAULT 'manual',
  email_thread_id TEXT,
  tenant_email TEXT,
  followup_1_sent INTEGER DEFAULT 0,
  followup_2_sent INTEGER DEFAULT 0,
  reminder_sent INTEGER DEFAULT 0,
  completion_sent INTEGER DEFAULT 0,
  completed_at DATETIME,
  calendly_event_uri TEXT,
  calendly_invitee_uri TEXT
);

CREATE TABLE IF NOT EXISTS email_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_order_id INTEGER,
  email_type TEXT NOT NULL,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  status TEXT DEFAULT 'sent',
  error_message TEXT,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gmail_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  access_token TEXT,
  refresh_token TEXT,
  expiry_date INTEGER,
  email TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('followup_1_hours', '48'),
  ('followup_2_hours', '96'),
  ('reminder_hours', '24'),
  ('min_gap_minutes', '30'),
  ('calendly_event_url', ''),
  ('business_name', 'Maintenance Dispatch'),
  ('technician_name', 'Juan Ramirez'),
  ('tech_email', 'juan20643@gmail.com'),
  ('notifications_enabled', 'true');
