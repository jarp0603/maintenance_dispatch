create table public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  address_line1 text not null,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  property_manager_name text,
  property_manager_phone text,
  property_manager_email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index properties_owner_id_idx on public.properties (owner_id);
create index properties_owner_name_idx on public.properties (owner_id, name);

create trigger properties_set_updated_at
  before update on public.properties
  for each row
  execute function public.set_updated_at();

alter table public.properties enable row level security;

create policy "properties_owner_all"
  on public.properties for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

grant select, insert, update, delete on public.properties to authenticated, service_role;
