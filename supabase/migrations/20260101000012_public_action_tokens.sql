create table public.public_action_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  token_hash text not null,
  purpose text not null check (purpose in ('completion_verification', 'rating', 'scheduling')),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index public_action_tokens_token_hash_key on public.public_action_tokens (token_hash);
create index public_action_tokens_work_order_purpose_idx
  on public.public_action_tokens (work_order_id, purpose);

alter table public.public_action_tokens enable row level security;

-- No policies: tokens are looked up by hash from an unauthenticated public
-- page, via service_role only. Never exposed through anon/authenticated roles.
revoke all on public.public_action_tokens from authenticated, anon;
grant select, insert, update, delete on public.public_action_tokens to service_role;
