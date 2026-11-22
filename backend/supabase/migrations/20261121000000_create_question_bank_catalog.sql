create table if not exists public.question_bank_catalog (
  catalog_id integer primary key default 1 check (catalog_id = 1),
  products jsonb not null default '[]'::jsonb check (jsonb_typeof(products) = 'array'),
  subjects jsonb not null default '[]'::jsonb check (jsonb_typeof(subjects) = 'array'),
  questions jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
  updated_at timestamptz not null default now()
);

alter table public.question_bank_catalog enable row level security;
revoke all on table public.question_bank_catalog from anon, authenticated;
grant all on table public.question_bank_catalog to service_role;
