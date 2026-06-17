create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('calendly')),
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  signature_verified boolean not null default false,
  processed_at timestamptz,
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processed', 'duplicate', 'invalid_signature', 'error')),
  error_message text,
  received_at timestamptz not null default now()
);

-- Duplicate webhook delivery protection.
create unique index webhook_events_provider_event_id_key on public.webhook_events (provider, event_id);
create index webhook_events_processing_status_idx on public.webhook_events (processing_status);

alter table public.webhook_events enable row level security;

-- No policies: only the webhook handler (service_role) ever touches this table.
revoke all on public.webhook_events from authenticated, anon;
grant select, insert, update, delete on public.webhook_events to service_role;
