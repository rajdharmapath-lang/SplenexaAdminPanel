create table if not exists public.question_bank_products (
  product_id text primary key,
  name text not null,
  description text not null default '',
  access_type text not null default 'Paid' check (access_type in ('Paid', 'Free')),
  is_active boolean not null default true,
  supports_topics boolean not null default true,
  is_review_enabled boolean not null default false,
  icon_data_url text not null default '',
  icon_bootstrap_class text not null default '',
  show_icon boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.question_bank_products enable row level security;
revoke all on table public.question_bank_products from anon, authenticated;
grant all on table public.question_bank_products to service_role;

insert into public.question_bank_products (
  product_id,
  name,
  description,
  access_type,
  is_active,
  supports_topics,
  is_review_enabled,
  icon_data_url,
  icon_bootstrap_class,
  show_icon,
  display_order
)
select
  coalesce(nullif(item.product ->> 'id', ''), 'legacy-product-' || item.ordinality::text),
  coalesce(nullif(item.product ->> 'name', ''), 'Untitled product'),
  coalesce(item.product ->> 'description', ''),
  case when item.product ->> 'accessType' = 'Free' then 'Free' else 'Paid' end,
  coalesce(nullif(item.product ->> 'isActive', '')::boolean, true),
  coalesce(nullif(item.product ->> 'supportsTopics', '')::boolean, true),
  coalesce(nullif(item.product ->> 'isReviewEnabled', '')::boolean, false),
  coalesce(item.product ->> 'iconDataUrl', ''),
  coalesce(item.product ->> 'iconBootstrapClass', ''),
  coalesce(nullif(item.product ->> 'showIcon', '')::boolean, true),
  item.ordinality::integer - 1
from public.question_bank_catalog as catalog
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(catalog.products) = 'array' then catalog.products
    else '[]'::jsonb
  end
) with ordinality as item(product, ordinality)
where catalog.catalog_id = 1
on conflict (product_id) do nothing;

create or replace function public.save_question_bank_catalog(
  p_products jsonb,
  p_subjects jsonb,
  p_questions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(jsonb_typeof(p_products), '') <> 'array'
    or coalesce(jsonb_typeof(p_subjects), '') <> 'array'
    or coalesce(jsonb_typeof(p_questions), '') <> 'array' then
    raise exception 'Question Bank data must contain product, subject, and question arrays.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_products) as product(value)
    where coalesce(jsonb_typeof(product.value), '') <> 'object'
      or nullif(btrim(product.value ->> 'id'), '') is null
      or nullif(btrim(product.value ->> 'name'), '') is null
  ) then
    raise exception 'Every product must have an ID and a name.';
  end if;

  if exists (
    select product.value ->> 'id'
    from jsonb_array_elements(p_products) as product(value)
    group by product.value ->> 'id'
    having count(*) > 1
  ) then
    raise exception 'Product IDs must be unique.';
  end if;

  insert into public.question_bank_products (
    product_id,
    name,
    description,
    access_type,
    is_active,
    supports_topics,
    is_review_enabled,
    icon_data_url,
    icon_bootstrap_class,
    show_icon,
    display_order,
    updated_at
  )
  select
    nullif(product.value ->> 'id', ''),
    product.value ->> 'name',
    coalesce(product.value ->> 'description', ''),
    case when product.value ->> 'accessType' = 'Free' then 'Free' else 'Paid' end,
    coalesce(nullif(product.value ->> 'isActive', '')::boolean, true),
    coalesce(nullif(product.value ->> 'supportsTopics', '')::boolean, true),
    coalesce(nullif(product.value ->> 'isReviewEnabled', '')::boolean, false),
    coalesce(product.value ->> 'iconDataUrl', ''),
    coalesce(product.value ->> 'iconBootstrapClass', ''),
    coalesce(nullif(product.value ->> 'showIcon', '')::boolean, true),
    product.ordinality::integer - 1,
    now()
  from jsonb_array_elements(p_products) with ordinality as product(value, ordinality)
  on conflict (product_id) do update set
    name = excluded.name,
    description = excluded.description,
    access_type = excluded.access_type,
    is_active = excluded.is_active,
    supports_topics = excluded.supports_topics,
    is_review_enabled = excluded.is_review_enabled,
    icon_data_url = excluded.icon_data_url,
    icon_bootstrap_class = excluded.icon_bootstrap_class,
    show_icon = excluded.show_icon,
    display_order = excluded.display_order,
    updated_at = excluded.updated_at;

  delete from public.question_bank_products as stored_product
  where not exists (
    select 1
    from jsonb_array_elements(p_products) as product(value)
    where product.value ->> 'id' = stored_product.product_id
  );

  insert into public.question_bank_catalog (
    catalog_id,
    products,
    subjects,
    questions,
    updated_at
  )
  values (1, p_products, p_subjects, p_questions, now())
  on conflict (catalog_id) do update set
    products = excluded.products,
    subjects = excluded.subjects,
    questions = excluded.questions,
    updated_at = excluded.updated_at;

  return jsonb_build_object(
    'products', p_products,
    'subjects', p_subjects,
    'questions', p_questions
  );
end;
$$;

revoke all on function public.save_question_bank_catalog(jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_question_bank_catalog(jsonb, jsonb, jsonb) to service_role;
