create table if not exists public."AppUsers" (
  id uuid primary key default gen_random_uuid(),
  dial_code text not null,
  phone text not null,
  name text,
  state text,
  batch_year integer,
  profile_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_phone_identity_unique unique (dial_code, phone),
  constraint app_users_batch_year_min check (batch_year is null or batch_year >= 2016)
);

alter table public."AppUsers" enable row level security;
revoke all on table public."AppUsers" from anon, authenticated;
grant all on table public."AppUsers" to service_role;

insert into public."AppUsers" (
  id,
  dial_code,
  phone,
  name,
  state,
  batch_year,
  profile_completed,
  created_at,
  updated_at
)
select
  id,
  dial_code,
  phone,
  name,
  state,
  batch_year,
  profile_completed,
  created_at,
  updated_at
from public.users
on conflict do nothing;
