create table public.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('google', 'calendly')),
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index integration_credentials_owner_provider_key
  on public.integration_credentials (owner_id, provider);

create trigger integration_credentials_set_updated_at
  before update on public.integration_credentials
  for each row
  execute function public.set_updated_at();

alter table public.integration_credentials enable row level security;

-- This table holds raw OAuth tokens. No policies are defined: it is
-- intentionally readable only by service_role (which bypasses RLS), never by
-- the authenticated or anon API roles, even for the owning user.
revoke all on public.integration_credentials from authenticated, anon;
grant select, insert, update, delete on public.integration_credentials to service_role;
