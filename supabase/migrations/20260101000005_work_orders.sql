create sequence public.work_order_reference_seq;

create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  reference_number text unique,
  tenant_id uuid references public.tenants (id) on delete set null,
  property_id uuid references public.properties (id) on delete set null,

  -- Direct snapshot fields. Populated at import/creation time and may be
  -- ahead of (or never linked to) a tenants/properties row: a parsed email
  -- can land here with messy data before anything is reconciled.
  tenant_name text not null default '',
  tenant_email text,
  tenant_phone text,
  property_name text,
  address text,
  unit text,
  property_manager text,

  issue_title text not null,
  issue_description text,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  access_instructions text,

  status text not null default 'new'
    check (status in (
      'new', 'needs_review', 'ready_to_contact', 'awaiting_tenant',
      'no_response', 'scheduled', 'en_route', 'arrived', 'in_progress',
      'completed', 'additional_work_required', 'closed', 'canceled'
    )),

  scheduled_at timestamptz,
  internal_notes text,
  completion_notes text,
  contact_attempt_count integer not null default 0,
  last_contact_at timestamptz,
  next_follow_up_at timestamptz,

  source text not null default 'manual' check (source in ('manual', 'gmail')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_work_order_reference_number()
returns trigger
language plpgsql
as $$
begin
  if new.reference_number is null then
    new.reference_number := 'WO-' || lpad(nextval('public.work_order_reference_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger work_orders_set_reference_number
  before insert on public.work_orders
  for each row
  execute function public.set_work_order_reference_number();

create trigger work_orders_set_updated_at
  before update on public.work_orders
  for each row
  execute function public.set_updated_at();

create index work_orders_owner_status_idx on public.work_orders (owner_id, status);
create index work_orders_owner_created_idx on public.work_orders (owner_id, created_at desc);
create index work_orders_tenant_id_idx on public.work_orders (tenant_id);
create index work_orders_property_id_idx on public.work_orders (property_id);

alter table public.work_orders enable row level security;

create policy "work_orders_owner_all"
  on public.work_orders for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

grant select, insert, update, delete on public.work_orders to authenticated, service_role;
grant usage on public.work_order_reference_seq to authenticated, service_role;
