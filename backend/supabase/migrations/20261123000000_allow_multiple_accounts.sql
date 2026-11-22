alter table public.admin_accounts
  drop constraint if exists admin_accounts_admin_id_check;

alter table public.admin_accounts
  drop constraint if exists admin_accounts_pkey;

alter table public.admin_accounts
  alter column admin_id drop default;

alter table public.admin_accounts
  alter column admin_id type uuid using gen_random_uuid();

alter table public.admin_accounts
  alter column admin_id set default gen_random_uuid();

alter table public.admin_accounts
  add constraint admin_accounts_pkey primary key (admin_id);
