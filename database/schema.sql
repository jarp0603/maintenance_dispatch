-- ============================================================================
-- Maintenance Dispatch — MySQL schema (Bluehost shared hosting compatible)
-- Engine: InnoDB · Charset: utf8mb4 · Tested against MySQL 5.7+/8.0 & MariaDB 10.3+
--
-- Import:  mysql -u <dbuser> -p <dbname> < schema.sql
-- Do NOT put real tenant data here. Use database/sample_data.sql for test data.
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- roles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(50)  NOT NULL,            -- 'administrator', 'technician'
  description VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- users  (replaces single-admin env login)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id       INT UNSIGNED NOT NULL,
  username      VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,          -- PHP password_hash()
  full_name     VARCHAR(150) NULL,
  phone         VARCHAR(40)  NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role_id),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- password_resets  (token-based reset structure)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_resets (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  token_hash VARCHAR(255) NOT NULL,             -- store a hash, never the raw token
  expires_at DATETIME     NOT NULL,
  used_at    DATETIME     NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pwreset_user (user_id),
  KEY idx_pwreset_expires (expires_at),
  CONSTRAINT fk_pwreset_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- login_attempts  (lockout / throttling)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_attempts (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username      VARCHAR(100) NULL,
  ip_address    VARBINARY(16) NULL,             -- inet_pton() form
  successful    TINYINT(1)   NOT NULL DEFAULT 0,
  attempted_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_login_username_time (username, attempted_at),
  KEY idx_login_ip_time (ip_address, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- properties
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS properties (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(150) NOT NULL,
  address     VARCHAR(255) NOT NULL,
  city        VARCHAR(100) NULL,
  state       VARCHAR(50)  NULL,
  postal_code VARCHAR(20)  NULL,
  notes       TEXT         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_properties_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- units  (a unit belongs to a property)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS units (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  property_id INT UNSIGNED NOT NULL,
  unit_number VARCHAR(50)  NOT NULL,
  beds        TINYINT UNSIGNED NULL,
  baths       DECIMAL(3,1) NULL,
  notes       TEXT         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_unit_per_property (property_id, unit_number),
  KEY idx_units_property (property_id),
  CONSTRAINT fk_units_property FOREIGN KEY (property_id) REFERENCES properties(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- tenants
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  unit_id     INT UNSIGNED NULL,                -- current unit, if known
  full_name   VARCHAR(150) NOT NULL,
  phone       VARCHAR(40)  NULL,
  email       VARCHAR(255) NULL,
  notes       TEXT         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tenants_unit (unit_id),
  KEY idx_tenants_name (full_name),
  KEY idx_tenants_email (email),
  CONSTRAINT fk_tenants_unit FOREIGN KEY (unit_id) REFERENCES units(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- work_orders
-- Status enum mirrors the brief: new, pending, contacted, scheduled,
-- in_progress, completed, no_response, cancelled.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_orders (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  wo_number       VARCHAR(30)  NOT NULL,        -- human-facing, e.g. WO-2026-0001
  property_id     INT UNSIGNED NULL,
  unit_id         INT UNSIGNED NULL,
  tenant_id       INT UNSIGNED NULL,
  created_by      INT UNSIGNED NULL,            -- users.id
  assigned_to     INT UNSIGNED NULL,            -- denormalized convenience; see assignments
  issue_type      VARCHAR(60)  NOT NULL DEFAULT 'general',
  description     TEXT         NULL,
  priority        ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  status          ENUM('new','pending','contacted','scheduled','in_progress',
                       'completed','no_response','cancelled') NOT NULL DEFAULT 'new',
  scheduled_date  DATE         NULL,
  scheduled_time  TIME         NULL,
  completed_at    DATETIME     NULL,
  archived_at     DATETIME     NULL,
  source          VARCHAR(30)  NOT NULL DEFAULT 'manual',  -- manual | email | api
  email_thread_id VARCHAR(255) NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wo_number (wo_number),
  KEY idx_wo_status (status),
  KEY idx_wo_priority (priority),
  KEY idx_wo_property (property_id),
  KEY idx_wo_unit (unit_id),
  KEY idx_wo_tenant (tenant_id),
  KEY idx_wo_assigned (assigned_to),
  KEY idx_wo_scheduled (scheduled_date),
  KEY idx_wo_created (created_at),
  KEY idx_wo_completed (completed_at),
  CONSTRAINT fk_wo_property FOREIGN KEY (property_id) REFERENCES properties(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_wo_unit FOREIGN KEY (unit_id) REFERENCES units(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_wo_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_wo_created_by FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_wo_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- work_order_assignments  (history of technician assignments)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_order_assignments (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  work_order_id INT UNSIGNED NOT NULL,
  user_id       INT UNSIGNED NOT NULL,          -- technician
  assigned_by   INT UNSIGNED NULL,
  assigned_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unassigned_at DATETIME     NULL,
  PRIMARY KEY (id),
  KEY idx_woa_wo (work_order_id),
  KEY idx_woa_user (user_id),
  CONSTRAINT fk_woa_wo FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_woa_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_woa_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- work_order_notes  (internal notes + completion notes)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_order_notes (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  work_order_id INT UNSIGNED NOT NULL,
  user_id       INT UNSIGNED NULL,
  note          TEXT         NOT NULL,
  is_completion TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_won_wo (work_order_id),
  CONSTRAINT fk_won_wo FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_won_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- work_order_status_history
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_order_status_history (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  work_order_id INT UNSIGNED NOT NULL,
  from_status   VARCHAR(30)  NULL,
  to_status     VARCHAR(30)  NOT NULL,
  changed_by    INT UNSIGNED NULL,
  changed_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_wosh_wo (work_order_id),
  KEY idx_wosh_changed (changed_at),
  CONSTRAINT fk_wosh_wo FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_wosh_user FOREIGN KEY (changed_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- scheduling_links  (secure, expiring tenant scheduling tokens)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduling_links (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  work_order_id INT UNSIGNED NOT NULL,
  token_hash    VARCHAR(255) NOT NULL,          -- hash of the random token
  created_by    INT UNSIGNED NULL,
  expires_at    DATETIME     NOT NULL,
  revoked_at    DATETIME     NULL,
  used_at       DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sched_token (token_hash),
  KEY idx_sched_wo (work_order_id),
  KEY idx_sched_expires (expires_at),
  CONSTRAINT fk_sched_wo FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_sched_created_by FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- availability_slots  (approved windows tenants may pick from)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS availability_slots (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NULL,                -- technician offering the slot
  slot_date   DATE         NOT NULL,
  start_time  TIME         NOT NULL,
  end_time    TIME         NOT NULL,
  is_open     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_avail_date (slot_date),
  KEY idx_avail_user (user_id),
  CONSTRAINT fk_avail_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- appointments  (confirmed bookings; unique slot prevents double-booking)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  work_order_id INT UNSIGNED NOT NULL,
  slot_id       INT UNSIGNED NULL,
  technician_id INT UNSIGNED NULL,
  appt_date     DATE         NOT NULL,
  start_time    TIME         NOT NULL,
  end_time      TIME         NULL,
  status        ENUM('confirmed','cancelled','completed') NOT NULL DEFAULT 'confirmed',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Prevent two confirmed appts on the same technician + date + start time.
  UNIQUE KEY uq_appt_tech_slot (technician_id, appt_date, start_time),
  KEY idx_appt_wo (work_order_id),
  KEY idx_appt_date (appt_date),
  CONSTRAINT fk_appt_wo FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_appt_slot FOREIGN KEY (slot_id) REFERENCES availability_slots(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_appt_tech FOREIGN KEY (technician_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- attachments  (approved uploads: photos / documents)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attachments (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  work_order_id  INT UNSIGNED NOT NULL,
  uploaded_by    INT UNSIGNED NULL,
  stored_name    VARCHAR(255) NOT NULL,         -- randomized on-disk filename
  original_name  VARCHAR(255) NULL,
  mime_type      VARCHAR(100) NULL,
  size_bytes     INT UNSIGNED NULL,
  is_completion  TINYINT(1)   NOT NULL DEFAULT 0,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_att_wo (work_order_id),
  CONSTRAINT fk_att_wo FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_att_user FOREIGN KEY (uploaded_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- email_imports  (Gmail-sourced maintenance requests)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_imports (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  work_order_id INT UNSIGNED NULL,              -- set once converted to a WO
  gmail_msg_id  VARCHAR(255) NOT NULL,
  thread_id     VARCHAR(255) NULL,
  from_email    VARCHAR(255) NULL,
  subject       VARCHAR(255) NULL,
  snippet       TEXT         NULL,
  received_at   DATETIME     NULL,
  processed     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_email_msg (gmail_msg_id),
  KEY idx_email_wo (work_order_id),
  CONSTRAINT fk_email_wo FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- email_logs  (outbound notifications: follow-ups, reminders, completion)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_logs (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  work_order_id INT UNSIGNED NULL,
  email_type    VARCHAR(40)  NOT NULL,
  recipient     VARCHAR(255) NOT NULL,
  subject       VARCHAR(255) NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'sent',
  error_message TEXT         NULL,
  sent_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_elog_wo (work_order_id),
  CONSTRAINT fk_elog_wo FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- audit_logs  (security-relevant actions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NULL,
  action      VARCHAR(80)  NOT NULL,            -- e.g. 'login', 'wo.update'
  entity_type VARCHAR(60)  NULL,
  entity_id   INT UNSIGNED NULL,
  ip_address  VARBINARY(16) NULL,
  detail      TEXT         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_user (user_id),
  KEY idx_audit_action (action),
  KEY idx_audit_created (created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- settings  (key/value app configuration)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  setting_key   VARCHAR(100) NOT NULL,
  setting_value TEXT         NULL,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- gmail_tokens  (OAuth token storage — one row per connected account)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gmail_tokens (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(255) NULL,
  access_token  TEXT         NULL,
  refresh_token TEXT         NULL,
  expiry_date   BIGINT       NULL,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gmail_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Seed: roles + default settings (idempotent)
-- ----------------------------------------------------------------------------
INSERT INTO roles (name, description) VALUES
  ('administrator', 'Full access to all data and settings'),
  ('technician',    'Assigned work orders and scheduling')
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT INTO settings (setting_key, setting_value) VALUES
  ('followup_1_hours', '48'),
  ('followup_2_hours', '96'),
  ('reminder_hours', '24'),
  ('min_gap_minutes', '30'),
  ('business_name', 'Maintenance Dispatch'),
  ('notifications_enabled', 'true')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

SET FOREIGN_KEY_CHECKS = 1;
-- End of schema.sql
