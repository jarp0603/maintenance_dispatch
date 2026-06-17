create table public.email_imports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  gmail_message_id text not null,
  gmail_thread_id text,
  work_order_id uuid references public.work_orders (id) on delete set null,
  raw_subject text,
  raw_from text,
  raw_snippet text,
  raw_body_text text,
  raw_body_html_sanitized text,
  parser_name text,
  parser_version text,
  parsed_fields jsonb,
  missing_fields text[] not null default '{}',
  warnings text[] not null default '{}',
  confidence_score numeric(4, 3),
  import_status text not null default 'imported'
    check (import_status in ('imported', 'needs_review', 'duplicate', 'error')),
  error_message text,
  imported_at timestamptz not null default now()
);

-- Duplicate-import protection: the same Gmail message can never be imported twice.
create unique index email_imports_owner_gmail_message_key
  on public.email_imports (owner_id, gmail_message_id);
create index email_imports_owner_status_idx on public.email_imports (owner_id, import_status);

alter table public.email_imports enable row level security;

-- email_imports is an immutable audit trail of what was received and parsed.
-- The operator reviews and corrects data on the linked work_order, not here,
-- so this role only needs read access.
create policy "email_imports_owner_select"
  on public.email_imports for select
  to authenticated
  using (owner_id = auth.uid());

grant select on public.email_imports to authenticated;
grant select, insert, update, delete on public.email_imports to service_role;
