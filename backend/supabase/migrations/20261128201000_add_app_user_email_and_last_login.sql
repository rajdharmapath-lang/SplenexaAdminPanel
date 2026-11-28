alter table public."AppUsers"
  add column if not exists email text,
  add column if not exists last_login_at timestamptz;
