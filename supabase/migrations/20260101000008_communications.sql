create table public.communications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  type text not null check (type in (
    'initial_scheduling', 'reminder', 'appointment_scheduled', 'en_route',
    'arrived', 'completion_verification', 'additional_work_required', 'manual'
  )),
  recipient_email text not null,
  subject text not null,
  rendered_body text not null,
  gmail_message_id text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  failure_reason text,
  idempotency_key text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index communications_idempotency_key_key on public.communications (idempotency_key);
create index communications_work_order_type_idx on public.communications (work_order_id, type);

alter table public.communications enable row level security;

create policy "communications_owner_all"
  on public.communications for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

grant select, insert, update, delete on public.communications to authenticated, service_role;
