create or replace function public.question_bank_question_key(question jsonb)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when lower(btrim(coalesce(question ->> 'text', ''))) = 'image-based question'
      or btrim(coalesce(question ->> 'text', '')) = ''
      then nullif(regexp_replace(coalesce(question ->> 'questionHtml', ''), E'\\s+', '', 'g'), '')
    else nullif(lower(regexp_replace(btrim(question ->> 'text'), E'\\s+', ' ', 'g')), '')
  end
$$;

create or replace function public.enforce_unique_question_bank_question_text()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  previous_questions jsonb := '[]'::jsonb;
begin
  if tg_op = 'UPDATE' then
    previous_questions := coalesce(old.questions, '[]'::jsonb);
  end if;

  if exists (
    with next_questions as (
      select
        question.value,
        question.ordinality,
        question.value ->> 'id' as question_id,
        public.question_bank_question_key(question.value) as question_key
      from jsonb_array_elements(coalesce(new.questions, '[]'::jsonb))
        with ordinality as question(value, ordinality)
    ),
    old_entries as (
      select
        question.value ->> 'id' as question_id,
        public.question_bank_question_key(question.value) as question_key
      from jsonb_array_elements(previous_questions) as question(value)
    ),
    changed_questions as (
      select next_question.*
      from next_questions as next_question
      where next_question.question_key is not null
        and not exists (
          select 1
          from old_entries as old_entry
          where next_question.question_id is not null
            and old_entry.question_id = next_question.question_id
            and old_entry.question_key is not distinct from next_question.question_key
        )
    )
    select 1
    from changed_questions as changed_question
    where exists (
      select 1
      from next_questions as other_question
      where other_question.ordinality <> changed_question.ordinality
        and other_question.question_key = changed_question.question_key
    )
  ) then
    raise exception using
      errcode = '23505',
      message = 'Question text must be unique across the Question Bank.';
  end if;

  return new;
end;
$$;

drop trigger if exists question_bank_catalog_unique_question_text
  on public.question_bank_catalog;

create trigger question_bank_catalog_unique_question_text
before insert or update on public.question_bank_catalog
for each row
execute function public.enforce_unique_question_bank_question_text();

revoke all on function public.question_bank_question_key(jsonb) from public, anon, authenticated;
grant execute on function public.question_bank_question_key(jsonb) to service_role;
