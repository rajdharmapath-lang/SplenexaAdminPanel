create table if not exists public.fee_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  product_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(product_ids) = 'array'),
  product_subjects jsonb not null default '{}'::jsonb check (jsonb_typeof(product_subjects) = 'object'),
  product_tests jsonb not null default '{}'::jsonb check (jsonb_typeof(product_tests) = 'object'),
  payment_mode text not null default 'One-time' check (payment_mode in ('One-time', 'Installments', 'Subscription')),
  status text not null default 'Draft' check (status in ('Draft', 'Published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists fee_plans_name_unique_idx
  on public.fee_plans (lower(btrim(name)));

create table if not exists public.fee_plan_prices (
  id uuid primary key default gen_random_uuid(),
  fee_plan_id uuid not null references public.fee_plans(id) on delete cascade,
  duration_months integer not null check (duration_months between 1 and 120),
  actual_price numeric(12, 2) not null check (actual_price >= 0),
  offer_price numeric(12, 2) not null check (offer_price >= 0 and offer_price <= actual_price),
  created_at timestamptz not null default now(),
  unique (fee_plan_id, duration_months)
);

create index if not exists fee_plan_prices_plan_duration_idx
  on public.fee_plan_prices (fee_plan_id, duration_months);

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  razorpay_order_id text not null unique,
  user_id uuid not null references public."AppUsers"(id) on delete restrict,
  fee_plan_id uuid references public.fee_plans(id) on delete set null,
  plan_name text not null,
  product_ids jsonb not null check (jsonb_typeof(product_ids) = 'array'),
  duration_months integer not null check (duration_months between 1 and 120),
  actual_price numeric(12, 2) not null check (actual_price >= 0),
  offer_price numeric(12, 2) not null check (offer_price > 0 and offer_price <= actual_price),
  amount bigint not null check (amount > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'created' check (status in ('created', 'captured')),
  razorpay_payment_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  payment_order_id uuid not null references public.payment_orders(id) on delete restrict,
  user_id uuid not null references public."AppUsers"(id) on delete restrict,
  razorpay_payment_id text not null unique,
  amount bigint not null check (amount > 0),
  currency text not null check (currency = 'INR'),
  status text not null check (status = 'captured'),
  method text,
  razorpay_created_at timestamptz,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.fee_plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public."AppUsers"(id) on delete restrict,
  fee_plan_id uuid references public.fee_plans(id) on delete set null,
  plan_name text not null,
  product_ids jsonb not null check (jsonb_typeof(product_ids) = 'array'),
  duration_months integer not null check (duration_months between 1 and 120),
  payment_order_id uuid not null unique references public.payment_orders(id) on delete restrict,
  purchased_at timestamptz not null default now(),
  valid_until timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists payment_orders_user_created_idx
  on public.payment_orders (user_id, created_at desc);
create index if not exists payment_transactions_user_created_idx
  on public.payment_transactions (user_id, created_at desc);
create index if not exists fee_plan_entitlements_user_valid_until_idx
  on public.fee_plan_entitlements (user_id, valid_until desc);

alter table public.fee_plans enable row level security;
alter table public.fee_plan_prices enable row level security;
alter table public.payment_orders enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.fee_plan_entitlements enable row level security;

revoke all on table public.fee_plans, public.fee_plan_prices, public.payment_orders,
  public.payment_transactions, public.fee_plan_entitlements from anon, authenticated;
grant all on table public.fee_plans, public.fee_plan_prices, public.payment_orders,
  public.payment_transactions, public.fee_plan_entitlements to service_role;

create or replace function public.save_fee_plan(
  p_id uuid,
  p_name text,
  p_description text,
  p_product_ids jsonb,
  p_product_subjects jsonb,
  p_product_tests jsonb,
  p_payment_mode text,
  p_status text,
  p_pricing_options jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_plan_id uuid := coalesce(p_id, gen_random_uuid());
begin
  if nullif(btrim(p_name), '') is null
    or length(btrim(p_name)) > 100
    or coalesce(jsonb_typeof(p_product_ids), '') <> 'array'
    or coalesce(jsonb_typeof(p_product_subjects), '') <> 'object'
    or coalesce(jsonb_typeof(p_product_tests), '') <> 'object'
    or coalesce(jsonb_typeof(p_pricing_options), '') <> 'array'
    or jsonb_array_length(p_product_ids) = 0
    or jsonb_array_length(p_pricing_options) = 0
    or p_payment_mode not in ('One-time', 'Installments', 'Subscription')
    or p_status not in ('Draft', 'Published') then
    raise exception 'Fee plan details are invalid.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_product_ids) as product(value)
    where jsonb_typeof(product.value) <> 'string'
      or nullif(btrim(product.value #>> '{}'), '') is null
  ) or exists (
    select product.value #>> '{}'
    from jsonb_array_elements(p_product_ids) as product(value)
    group by product.value #>> '{}'
    having count(*) > 1
  ) then
    raise exception 'Fee plan product IDs must be non-empty and unique.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_pricing_options) as price(value)
    where jsonb_typeof(price.value) <> 'object'
      or coalesce(price.value ->> 'months', '') !~ '^[0-9]+$'
      or (price.value ->> 'months')::integer not between 1 and 120
      or coalesce(jsonb_typeof(price.value -> 'actualPrice'), '') <> 'number'
      or coalesce(jsonb_typeof(price.value -> 'offerPrice'), '') <> 'number'
      or (price.value ->> 'actualPrice')::numeric < 0
      or (price.value ->> 'offerPrice')::numeric < 0
      or (price.value ->> 'offerPrice')::numeric > (price.value ->> 'actualPrice')::numeric
      or (p_status = 'Published' and (
        (price.value ->> 'actualPrice')::numeric <= 0
        or (price.value ->> 'offerPrice')::numeric <= 0
      ))
  ) or exists (
    select (price.value ->> 'months')::integer
    from jsonb_array_elements(p_pricing_options) as price(value)
    group by (price.value ->> 'months')::integer
    having count(*) > 1
  ) then
    raise exception 'Fee plan duration and prices are invalid.' using errcode = '22023';
  end if;

  insert into public.fee_plans (
    id, name, description, product_ids, product_subjects, product_tests,
    payment_mode, status, updated_at
  ) values (
    v_plan_id, btrim(p_name), coalesce(p_description, ''), p_product_ids,
    p_product_subjects, p_product_tests, p_payment_mode, p_status, now()
  )
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    product_ids = excluded.product_ids,
    product_subjects = excluded.product_subjects,
    product_tests = excluded.product_tests,
    payment_mode = excluded.payment_mode,
    status = excluded.status,
    updated_at = excluded.updated_at;

  delete from public.fee_plan_prices where fee_plan_id = v_plan_id;

  insert into public.fee_plan_prices (fee_plan_id, duration_months, actual_price, offer_price)
  select
    v_plan_id,
    (price.value ->> 'months')::integer,
    (price.value ->> 'actualPrice')::numeric,
    (price.value ->> 'offerPrice')::numeric
  from jsonb_array_elements(p_pricing_options) as price(value);

  return v_plan_id;
end;
$$;

create or replace function public.record_captured_fee_plan_payment(
  p_razorpay_order_id text,
  p_user_id uuid,
  p_razorpay_payment_id text,
  p_amount bigint,
  p_currency text,
  p_method text,
  p_razorpay_created_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.payment_orders%rowtype;
  v_transaction public.payment_transactions%rowtype;
  v_entitlement public.fee_plan_entitlements%rowtype;
begin
  select *
  into v_order
  from public.payment_orders
  where razorpay_order_id = p_razorpay_order_id
    and user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  if v_order.status = 'captured' then
    if v_order.razorpay_payment_id is distinct from p_razorpay_payment_id then
      return jsonb_build_object('outcome', 'conflict');
    end if;

    select * into v_entitlement
    from public.fee_plan_entitlements
    where payment_order_id = v_order.id;

    return jsonb_build_object('outcome', 'captured', 'entitlement', to_jsonb(v_entitlement));
  end if;

  if p_amount <> v_order.amount or p_currency <> v_order.currency then
    raise exception 'Captured payment does not match the stored order.' using errcode = '22023';
  end if;

  insert into public.payment_transactions (
    payment_order_id, user_id, razorpay_payment_id, amount, currency, status,
    method, razorpay_created_at
  ) values (
    v_order.id, p_user_id, p_razorpay_payment_id, p_amount, p_currency, 'captured',
    p_method, p_razorpay_created_at
  )
  returning * into v_transaction;

  update public.payment_orders
  set status = 'captured',
      razorpay_payment_id = p_razorpay_payment_id,
      updated_at = now()
  where id = v_order.id;

  insert into public.fee_plan_entitlements (
    user_id, fee_plan_id, plan_name, product_ids, duration_months,
    payment_order_id, purchased_at, valid_until
  ) values (
    p_user_id, v_order.fee_plan_id, v_order.plan_name, v_order.product_ids,
    v_order.duration_months, v_order.id, now(),
    now() + make_interval(months => v_order.duration_months)
  )
  returning * into v_entitlement;

  return jsonb_build_object('outcome', 'captured', 'entitlement', to_jsonb(v_entitlement));
end;
$$;

revoke all on function public.save_fee_plan(uuid, text, text, jsonb, jsonb, jsonb, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.record_captured_fee_plan_payment(text, uuid, text, bigint, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.save_fee_plan(uuid, text, text, jsonb, jsonb, jsonb, text, text, jsonb)
  to service_role;
grant execute on function public.record_captured_fee_plan_payment(text, uuid, text, bigint, text, text, timestamptz)
  to service_role;
