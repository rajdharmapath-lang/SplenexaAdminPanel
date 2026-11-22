create table if not exists public.question_bank_tests (
  test_id text primary key,
  product_id text not null references public.question_bank_products(product_id) on delete cascade,
  title text not null,
  icon_bootstrap_class text not null default '',
  add_topic_under_test boolean not null default false,
  subject_id text not null,
  topic text,
  topic_icon_bootstrap_class text not null default '',
  question_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(question_ids) = 'array'),
  question_selection_enabled boolean not null default false,
  total_questions integer not null default 0 check (total_questions >= 0),
  total_marks numeric not null default 0 check (total_marks >= 0),
  marks_per_question numeric not null default 1 check (marks_per_question >= 0),
  marks_enabled boolean not null default true,
  negative_marking numeric not null default 0 check (negative_marking >= 0),
  negative_marking_enabled boolean not null default false,
  start_date_time_enabled boolean not null default false,
  start_at timestamptz,
  end_date_time_enabled boolean not null default false,
  end_at timestamptz,
  duration_enabled boolean not null default false,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not start_date_time_enabled or start_at is not null),
  check (not end_date_time_enabled or end_at is not null),
  check (not duration_enabled or duration_minutes is not null),
  check (start_at is null or end_at is null or end_at > start_at)
);

create index if not exists question_bank_tests_product_id_idx
  on public.question_bank_tests(product_id);

alter table public.question_bank_tests enable row level security;
revoke all on table public.question_bank_tests from anon, authenticated;
grant all on table public.question_bank_tests to service_role;

drop function if exists public.save_question_bank_catalog(jsonb, jsonb, jsonb);

create or replace function public.save_question_bank_catalog(
  p_products jsonb,
  p_subjects jsonb,
  p_questions jsonb,
  p_tests jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  saved_tests jsonb;
begin
  if coalesce(jsonb_typeof(p_products), '') <> 'array'
    or coalesce(jsonb_typeof(p_subjects), '') <> 'array'
    or coalesce(jsonb_typeof(p_questions), '') <> 'array'
    or (p_tests is not null and jsonb_typeof(p_tests) <> 'array') then
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

  if p_tests is not null then
    if exists (
      select 1
      from jsonb_array_elements(p_tests) as test(value)
      where coalesce(jsonb_typeof(test.value), '') <> 'object'
        or nullif(btrim(test.value ->> 'id'), '') is null
        or nullif(btrim(test.value ->> 'productId'), '') is null
        or nullif(btrim(test.value ->> 'title'), '') is null
        or nullif(btrim(test.value ->> 'subjectId'), '') is null
        or (
          test.value ? 'questionIds'
          and coalesce(jsonb_typeof(test.value -> 'questionIds'), '') <> 'array'
        )
    ) then
      raise exception 'Every test must have an ID, product, title, subject, and a question ID array.';
    end if;

    if exists (
      select test.value ->> 'id'
      from jsonb_array_elements(p_tests) as test(value)
      group by test.value ->> 'id'
      having count(*) > 1
    ) then
      raise exception 'Test IDs must be unique.';
    end if;

    insert into public.question_bank_tests (
      test_id,
      product_id,
      title,
      icon_bootstrap_class,
      add_topic_under_test,
      subject_id,
      topic,
      topic_icon_bootstrap_class,
      question_ids,
      question_selection_enabled,
      total_questions,
      total_marks,
      marks_per_question,
      marks_enabled,
      negative_marking,
      negative_marking_enabled,
      start_date_time_enabled,
      start_at,
      end_date_time_enabled,
      end_at,
      duration_enabled,
      duration_minutes,
      is_published,
      updated_at
    )
    select
      test.value ->> 'id',
      test.value ->> 'productId',
      test.value ->> 'title',
      coalesce(test.value ->> 'iconBootstrapClass', ''),
      coalesce(nullif(test.value ->> 'addTopicUnderTest', '')::boolean, false),
      test.value ->> 'subjectId',
      nullif(test.value ->> 'topic', ''),
      coalesce(test.value ->> 'topicIconBootstrapClass', ''),
      coalesce(test.value -> 'questionIds', '[]'::jsonb),
      coalesce(nullif(test.value ->> 'questionSelectionEnabled', '')::boolean, false),
      coalesce(nullif(test.value ->> 'totalQuestions', '')::integer, 0),
      coalesce(nullif(test.value ->> 'totalMarks', '')::numeric, 0),
      coalesce(nullif(test.value ->> 'marksPerQuestion', '')::numeric, 1),
      coalesce(nullif(test.value ->> 'marksEnabled', '')::boolean, true),
      coalesce(nullif(test.value ->> 'negativeMarking', '')::numeric, 0),
      coalesce(nullif(test.value ->> 'negativeMarkingEnabled', '')::boolean, false),
      coalesce(nullif(test.value ->> 'startDateTimeEnabled', '')::boolean, false),
      nullif(test.value ->> 'startAt', '')::timestamptz,
      coalesce(nullif(test.value ->> 'endDateTimeEnabled', '')::boolean, false),
      nullif(test.value ->> 'endAt', '')::timestamptz,
      coalesce(nullif(test.value ->> 'durationEnabled', '')::boolean, false),
      nullif(test.value ->> 'durationMinutes', '')::integer,
      coalesce(nullif(test.value ->> 'isPublished', '')::boolean, false),
      now()
    from jsonb_array_elements(p_tests) as test(value)
    where exists (
      select 1 from public.question_bank_products as product
      where product.product_id = test.value ->> 'productId'
    )
    on conflict (test_id) do update set
      product_id = excluded.product_id,
      title = excluded.title,
      icon_bootstrap_class = excluded.icon_bootstrap_class,
      add_topic_under_test = excluded.add_topic_under_test,
      subject_id = excluded.subject_id,
      topic = excluded.topic,
      topic_icon_bootstrap_class = excluded.topic_icon_bootstrap_class,
      question_ids = excluded.question_ids,
      question_selection_enabled = excluded.question_selection_enabled,
      total_questions = excluded.total_questions,
      total_marks = excluded.total_marks,
      marks_per_question = excluded.marks_per_question,
      marks_enabled = excluded.marks_enabled,
      negative_marking = excluded.negative_marking,
      negative_marking_enabled = excluded.negative_marking_enabled,
      start_date_time_enabled = excluded.start_date_time_enabled,
      start_at = excluded.start_at,
      end_date_time_enabled = excluded.end_date_time_enabled,
      end_at = excluded.end_at,
      duration_enabled = excluded.duration_enabled,
      duration_minutes = excluded.duration_minutes,
      is_published = excluded.is_published,
      updated_at = excluded.updated_at;

    delete from public.question_bank_tests as stored_test
    where not exists (
      select 1
      from jsonb_array_elements(p_tests) as test(value)
      where test.value ->> 'id' = stored_test.test_id
        and test.value ->> 'productId' = stored_test.product_id
        and exists (
          select 1 from public.question_bank_products as product
          where product.product_id = stored_test.product_id
        )
    );
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', test_id,
      'productId', product_id,
      'title', title,
      'iconBootstrapClass', icon_bootstrap_class,
      'addTopicUnderTest', add_topic_under_test,
      'subjectId', subject_id,
      'topic', topic,
      'topicIconBootstrapClass', topic_icon_bootstrap_class,
      'questionIds', question_ids,
      'questionSelectionEnabled', question_selection_enabled,
      'totalQuestions', total_questions,
      'totalMarks', total_marks,
      'marksPerQuestion', marks_per_question,
      'marksEnabled', marks_enabled,
      'negativeMarking', negative_marking,
      'negativeMarkingEnabled', negative_marking_enabled,
      'startDateTimeEnabled', start_date_time_enabled,
      'startAt', start_at,
      'endDateTimeEnabled', end_date_time_enabled,
      'endAt', end_at,
      'durationEnabled', duration_enabled,
      'durationMinutes', duration_minutes,
      'isPublished', is_published,
      'createdAt', created_at
    ) order by created_at),
    '[]'::jsonb
  )
  into saved_tests
  from public.question_bank_tests;

  return jsonb_build_object(
    'products', p_products,
    'subjects', p_subjects,
    'questions', p_questions,
    'tests', saved_tests
  );
end;
$$;

revoke all on function public.save_question_bank_catalog(jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_question_bank_catalog(jsonb, jsonb, jsonb, jsonb) to service_role;
