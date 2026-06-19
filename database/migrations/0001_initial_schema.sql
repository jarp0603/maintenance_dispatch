-- Migration 0001 — initial schema
-- This migration creates the full baseline schema. It is equivalent to
-- database/schema.sql and exists so future changes can be applied as ordered,
-- additive migration files (0002_*.sql, 0003_*.sql, ...).
--
-- Apply:  mysql -u <user> -p <db> < database/migrations/0001_initial_schema.sql
--
-- For the initial install, importing database/schema.sql is sufficient. Keep
-- new structural changes as separate numbered files in this directory; never
-- edit a migration that has already been applied to a shared environment.

SOURCE schema.sql;
-- Note: the SOURCE directive works in the mysql CLI run from the database/
-- directory. If your client does not support SOURCE, import schema.sql directly.
