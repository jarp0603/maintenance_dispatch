create table public.work_order_attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  email_import_id uuid references public.email_imports (id) on delete set null,
  file_name text not null,
  content_type text,
  size_bytes integer,
  storage_path text not null,
  gmail_attachment_id text,
  created_at timestamptz not null default now()
);

create index work_order_attachments_work_order_id_idx on public.work_order_attachments (work_order_id);

alter table public.work_order_attachments enable row level security;

create policy "work_order_attachments_owner_select"
  on public.work_order_attachments for select
  to authenticated
  using (owner_id = auth.uid());

create policy "work_order_attachments_owner_delete"
  on public.work_order_attachments for delete
  to authenticated
  using (owner_id = auth.uid());

grant select, delete on public.work_order_attachments to authenticated;
grant select, insert, update, delete on public.work_order_attachments to service_role;
