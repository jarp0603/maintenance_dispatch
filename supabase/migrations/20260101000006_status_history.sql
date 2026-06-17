create table public.status_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index status_history_work_order_id_idx on public.status_history (work_order_id, created_at);

alter table public.status_history enable row level security;

create policy "status_history_owner_all"
  on public.status_history for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

grant select, insert, update, delete on public.status_history to authenticated, service_role;
