create table if not exists public.admin_accounts (
  admin_id uuid primary key default gen_random_uuid(),
  first_name text not null check (length(btrim(first_name)) between 1 and 80),
  last_name text not null check (length(btrim(last_name)) between 1 and 80),
  professional text not null check (professional in ('Student', 'Doctor')),
  mobile text not null,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.admin_accounts enable row level security;
revoke all on table public.admin_accounts from anon, authenticated;
grant all on table public.admin_accounts to service_role;
