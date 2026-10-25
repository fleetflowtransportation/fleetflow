-- Secure, single-booking public management links.
-- Raw tokens are never stored in the database; only SHA-256 hashes are stored.
create table if not exists public.booking_manage_tokens (
  id uuid primary key default gen_random_uuid(),
  booking_id text not null references public.bookings(id) on delete cascade,
  tenant_id text not null references public.tenants(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists booking_manage_tokens_booking_tenant_idx
  on public.booking_manage_tokens (booking_id, tenant_id);

alter table public.booking_manage_tokens enable row level security;
revoke all on table public.booking_manage_tokens from anon, authenticated;
grant all on table public.booking_manage_tokens to service_role;

create table if not exists public.booking_manage_activity_logs (
  id uuid primary key default gen_random_uuid(),
  booking_id text not null,
  tenant_id text not null,
  action text not null check (action in ('updated_route', 'cancelled')),
  reason text,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists booking_manage_activity_logs_booking_idx
  on public.booking_manage_activity_logs (tenant_id, booking_id, created_at desc);

alter table public.booking_manage_activity_logs enable row level security;
revoke all on table public.booking_manage_activity_logs from anon, authenticated;
grant all on table public.booking_manage_activity_logs to service_role;
