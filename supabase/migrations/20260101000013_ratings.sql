create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  public_action_token_id uuid references public.public_action_tokens (id) on delete set null,
  rating integer check (rating between 1 and 5),
  comment text,
  tenant_confirmed_complete boolean,
  issue_unresolved boolean not null default false,
  submitted_at timestamptz not null default now()
);

-- One final rating per work order.
create unique index ratings_work_order_id_key on public.ratings (work_order_id);

alter table public.ratings enable row level security;

create policy "ratings_owner_select"
  on public.ratings for select
  to authenticated
  using (owner_id = auth.uid());

grant select on public.ratings to authenticated;
grant select, insert, update, delete on public.ratings to service_role;
