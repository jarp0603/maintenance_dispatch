create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  calendly_event_uri text,
  calendly_invitee_uri text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'canceled', 'rescheduled', 'completed')),
  cancel_url text,
  reschedule_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index appointments_calendly_event_uri_key
  on public.appointments (calendly_event_uri)
  where calendly_event_uri is not null;

create index appointments_work_order_id_idx on public.appointments (work_order_id);

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row
  execute function public.set_updated_at();

alter table public.appointments enable row level security;

create policy "appointments_owner_all"
  on public.appointments for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

grant select, insert, update, delete on public.appointments to authenticated, service_role;
