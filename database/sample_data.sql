-- ============================================================================
-- Maintenance Dispatch — SAMPLE DATA (fictional, for testing only)
--
-- WARNING: Do NOT load this into production. All names, emails, phone numbers,
-- and addresses below are invented for testing. Never replace these with real
-- tenant information in a committed file.
--
-- Run AFTER schema.sql:  mysql -u <user> -p <db> < database/sample_data.sql
--
-- The demo password hashes below correspond to the password "ChangeMe123!".
-- They are bcrypt hashes ($2y$) compatible with PHP password_verify().
-- Replace/disable these accounts before any real deployment.
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Users (role_id 1 = administrator, 2 = technician, per schema seed) ----------
INSERT INTO users (role_id, username, email, password_hash, full_name, phone, is_active) VALUES
  (1, 'admin',  'admin@example.test', '$2b$10$ZGziEc6yGuea3vEVMWulKOHDVAshAtMWzLm3giBzgfVgPG3JlP2z2', 'Demo Admin', '555-0100', 1),
  (2, 'tech1',  'tech1@example.test', '$2b$10$ZGziEc6yGuea3vEVMWulKOHDVAshAtMWzLm3giBzgfVgPG3JlP2z2', 'Alex Rivera', '555-0111', 1),
  (2, 'tech2',  'tech2@example.test', '$2b$10$ZGziEc6yGuea3vEVMWulKOHDVAshAtMWzLm3giBzgfVgPG3JlP2z2', 'Sam Chen',    '555-0112', 1);

-- Properties ------------------------------------------------------------------
INSERT INTO properties (name, address, city, state, postal_code) VALUES
  ('Maple Court Apartments', '120 Maple St',  'Springfield', 'IL', '62704'),
  ('Cedar Ridge Townhomes',  '88 Cedar Ave',  'Springfield', 'IL', '62711');

-- Units -----------------------------------------------------------------------
INSERT INTO units (property_id, unit_number, beds, baths) VALUES
  (1, '101', 2, 1.0),
  (1, '102', 1, 1.0),
  (1, '203', 3, 2.0),
  (2, 'A',   2, 1.5),
  (2, 'B',   2, 1.5);

-- Tenants ---------------------------------------------------------------------
INSERT INTO tenants (unit_id, full_name, phone, email) VALUES
  (1, 'Jordan Blake',  '555-0201', 'jordan.blake@example.test'),
  (2, 'Casey Morgan',  '555-0202', 'casey.morgan@example.test'),
  (3, 'Taylor Quinn',  '555-0203', 'taylor.quinn@example.test'),
  (4, 'Riley Parker',  '555-0204', 'riley.parker@example.test');

-- Work orders -----------------------------------------------------------------
INSERT INTO work_orders
  (wo_number, property_id, unit_id, tenant_id, created_by, assigned_to,
   issue_type, description, priority, status, scheduled_date, scheduled_time, source) VALUES
  ('WO-2026-0001', 1, 1, 1, 1, 2, 'plumbing',  'Kitchen sink draining slowly.',        'medium', 'scheduled',  '2026-06-22', '10:00:00', 'manual'),
  ('WO-2026-0002', 1, 2, 2, 1, 2, 'electrical','Bedroom outlet not working.',          'high',   'in_progress', NULL,        NULL,       'manual'),
  ('WO-2026-0003', 1, 3, 3, 1, 3, 'hvac',      'AC not cooling.',                      'urgent', 'new',         NULL,        NULL,       'email'),
  ('WO-2026-0004', 2, 4, 4, 1, NULL,'appliance','Dishwasher leaking under the door.',  'low',    'pending',     NULL,        NULL,       'manual'),
  ('WO-2026-0005', 1, 1, 1, 1, 2, 'general',   'Replace smoke detector battery.',      'low',    'completed',   '2026-06-15', '09:00:00', 'manual');

UPDATE work_orders SET completed_at = '2026-06-15 09:45:00' WHERE wo_number = 'WO-2026-0005';

-- Assignments -----------------------------------------------------------------
INSERT INTO work_order_assignments (work_order_id, user_id, assigned_by) VALUES
  (1, 2, 1), (2, 2, 1), (3, 3, 1), (5, 2, 1);

-- Notes -----------------------------------------------------------------------
INSERT INTO work_order_notes (work_order_id, user_id, note, is_completion) VALUES
  (2, 2, 'Confirmed breaker tripped; replacing outlet.', 0),
  (5, 2, 'Battery replaced, tested alarm. Working.',      1);

-- Status history --------------------------------------------------------------
INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by) VALUES
  (1, 'new', 'pending',   1),
  (1, 'pending', 'scheduled', 1),
  (2, 'new', 'in_progress', 2),
  (5, 'scheduled', 'completed', 2);

-- Availability slots ----------------------------------------------------------
INSERT INTO availability_slots (user_id, slot_date, start_time, end_time, is_open) VALUES
  (2, '2026-06-22', '10:00:00', '11:00:00', 0),
  (2, '2026-06-22', '13:00:00', '14:00:00', 1),
  (3, '2026-06-23', '09:00:00', '10:00:00', 1);

-- Appointments (WO-1 booked into the 10:00 slot) ------------------------------
INSERT INTO appointments (work_order_id, slot_id, technician_id, appt_date, start_time, end_time, status) VALUES
  (1, 1, 2, '2026-06-22', '10:00:00', '11:00:00', 'confirmed');

SET FOREIGN_KEY_CHECKS = 1;
-- End of sample_data.sql
