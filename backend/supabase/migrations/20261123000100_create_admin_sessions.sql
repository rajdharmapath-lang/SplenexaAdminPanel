create table if not exists public.admin_sessions (
  jti uuid primary key,
  admin_id uuid not null references public.admin_accounts(admin_id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists admin_sessions_admin_id_idx
  on public.admin_sessions (admin_id);

alter table public.admin_sessions enable row level security;
revoke all on table public.admin_sessions from anon, authenticated;
grant all on table public.admin_sessions to service_role;
