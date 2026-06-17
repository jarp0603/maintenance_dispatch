create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  property_id uuid references public.properties (id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  unit text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenants_owner_id_idx on public.tenants (owner_id);
create index tenants_owner_email_idx on public.tenants (owner_id, email);
create index tenants_owner_phone_idx on public.tenants (owner_id, phone);
create index tenants_property_id_idx on public.tenants (property_id);

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row
  execute function public.set_updated_at();

alter table public.tenants enable row level security;

create policy "tenants_owner_all"
  on public.tenants for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

grant select, insert, update, delete on public.tenants to authenticated, service_role;
