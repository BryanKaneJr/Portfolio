-- BrainScroll: initial schema (Stage 1 data contracts).
--
-- Principles (docs/product-rules.md):
--   * Stable text IDs, never display names, as keys.
--   * Published level content is an immutable revision bundle; user progress
--     references stable level IDs and survives editorial revisions.
--   * The server owns completion, XP, daily allowance and entitlements.
--     Clients read their own progress; they never write it directly.
--   * XP is an immutable ledger with idempotency keys.

-- ─────────────────────────────────────────────────────────────────────────────
-- Settings (mirrors packages/core/src/constants.ts; change both together)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.app_settings (
  id boolean primary key default true check (id),
  daily_free_new_levels int not null default 5,
  first_day_new_levels int not null default 10,
  mastery_band_size int not null default 100,
  xp_level_complete int not null default 20,
  xp_question_correct int not null default 2,
  xp_question_correct_cap int not null default 6,
  xp_mastery_clear int not null default 250
);
insert into public.app_settings default values;

-- ─────────────────────────────────────────────────────────────────────────────
-- Types
-- ─────────────────────────────────────────────────────────────────────────────

create type public.content_status as enum ('draft', 'in_review', 'published', 'retired');
create type public.content_license as enum (
  'CC0', 'public_domain', 'US_gov_public_domain', 'CC_BY', 'CC_BY_SA', 'reference_only', 'licensed', 'unknown'
);
create type public.level_concept_role as enum ('teach', 'reinforce', 'recall');
create type public.xp_event_type as enum ('LEVEL_COMPLETE', 'QUESTION_CORRECT', 'DELAYED_RECALL', 'MASTERY_CLEAR', 'CORRECTION');
create type public.report_category as enum ('factual', 'confusing_question', 'typo', 'media', 'other');
create type public.report_status as enum ('open', 'triaged', 'fixed', 'dismissed');

-- ─────────────────────────────────────────────────────────────────────────────
-- Curriculum
-- ─────────────────────────────────────────────────────────────────────────────

create table public.subjects (
  id text primary key check (id ~ '^subject\.[a-z0-9]+(_[a-z0-9]+)*$'),
  name text not null,
  sort_order int not null default 0,
  status public.content_status not null default 'draft'
);

create table public.skills (
  id text primary key check (id ~ '^skill\.[a-z0-9]+(_[a-z0-9]+)*\.[a-z0-9]+(_[a-z0-9]+)*$'),
  subject_id text not null references public.subjects (id),
  name text not null,
  description text not null default '',
  sort_order int not null default 0,
  status public.content_status not null default 'draft',
  max_published_level int not null default 0
);

create table public.sources (
  id text primary key check (id ~ '^source\.[a-z0-9]+(_[a-z0-9]+)*$'),
  title text not null,
  url text not null,
  publisher text not null,
  license public.content_license not null,
  accessed_at date not null,
  verified boolean not null default false,
  notes text
);

create table public.assets (
  id text primary key check (id ~ '^asset\.[a-z0-9]+(_[a-z0-9]+)*$'),
  type text not null check (type in ('image', 'diagram', 'map')),
  file text not null,
  alt_text text not null,
  license public.content_license not null,
  source_id text not null references public.sources (id),
  attribution text,
  width int not null check (width > 0),
  height int not null check (height > 0)
);

create table public.concepts (
  id text primary key check (id ~ '^concept\.[a-z0-9]+(_[a-z0-9]+)*\.[a-z0-9]+(_[a-z0-9]+)*$'),
  title text not null,
  description text not null,
  difficulty numeric(3, 2) not null check (difficulty between 0 and 1),
  facts jsonb not null default '[]'
);

create table public.levels (
  id text primary key check (id ~ '^level\.[a-z0-9]+(_[a-z0-9]+)*\.[a-z0-9]+(_[a-z0-9]+)*\.\d{3,}$'),
  skill_id text not null references public.skills (id),
  number int not null check (number > 0),
  title text not null,
  summary text not null default '',
  status public.content_status not null default 'draft',
  current_revision int,
  unique (skill_id, number)
);

-- Immutable published snapshots. The app renders `bundle` (the validated level JSON).
create table public.level_revisions (
  id text generated always as (level_id || '@r' || revision) stored primary key,
  level_id text not null references public.levels (id),
  revision int not null check (revision > 0),
  bundle jsonb not null,
  published_at timestamptz not null default now(),
  unique (level_id, revision)
);

alter table public.levels
  add constraint levels_current_revision_fk
  foreign key (id, current_revision) references public.level_revisions (level_id, revision);

create or replace function public.forbid_mutation() returns trigger
language plpgsql as $$
begin
  raise exception '% is immutable; publish a new revision instead', tg_table_name;
end $$;

create trigger level_revisions_immutable
  before update or delete on public.level_revisions
  for each row execute function public.forbid_mutation();

create table public.level_concepts (
  level_id text not null references public.levels (id) on delete cascade,
  concept_id text not null references public.concepts (id),
  role public.level_concept_role not null,
  weight numeric(3, 2) not null default 1 check (weight > 0 and weight <= 1),
  primary key (level_id, concept_id)
);

-- Questions are normalized (as well as living in the bundle) so the server can
-- grade answers and pick alternative questions for a due concept during review.
create table public.questions (
  id text primary key check (id ~ '^question\.[a-z0-9]+(_[a-z0-9]+)*\.\d{3,}\.q[1-9]\d*$'),
  level_id text not null references public.levels (id) on delete cascade,
  prompt text not null,
  explanation text not null,
  difficulty numeric(3, 2) not null check (difficulty between 0 and 1)
);

create table public.question_concepts (
  question_id text not null references public.questions (id) on delete cascade,
  concept_id text not null references public.concepts (id),
  primary key (question_id, concept_id)
);

create table public.answer_options (
  question_id text not null references public.questions (id) on delete cascade,
  option_id text not null check (option_id ~ '^[a-z]$'),
  label text not null,
  correct boolean not null,
  rationale text,
  primary key (question_id, option_id)
);
-- At most one correct option per question (the importer enforces at least one).
create unique index answer_options_one_correct on public.answer_options (question_id) where correct;

create table public.source_links (
  source_id text not null references public.sources (id),
  object_type text not null check (object_type in ('concept', 'level', 'question', 'asset')),
  object_id text not null,
  note text,
  primary key (source_id, object_type, object_id)
);

create index on public.levels (skill_id, number);
create index on public.questions (level_id);
create index on public.question_concepts (concept_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Users & progression
-- ─────────────────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  -- IANA zone; defines the user's local calendar day for the daily allowance.
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

create or replace function public.validate_profile_timezone() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'invalid time zone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end $$;

create trigger profiles_validate_timezone
  before insert or update of timezone on public.profiles
  for each row execute function public.validate_profile_timezone();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.user_skill_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  skill_id text not null references public.skills (id),
  -- Visible skill level: highest canonical level cleared. Never derived from XP.
  highest_cleared int not null default 0 check (highest_cleared >= 0),
  stars int not null default 0 check (stars >= 0),
  total_xp int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

create table public.user_level_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  level_id text not null references public.levels (id),
  started_at timestamptz not null default now(),
  started_revision int,
  completed_at timestamptz,
  completed_revision int,
  correct_count int,
  question_count int,
  idempotency_key uuid,
  primary key (user_id, level_id)
);

create table public.user_concept_mastery (
  user_id uuid not null references public.profiles (id) on delete cascade,
  concept_id text not null references public.concepts (id),
  -- 0..5; see packages/core/src/review.ts
  strength int not null default 0 check (strength between 0 and 5),
  seen_count int not null default 0,
  correct_count int not null default 0,
  incorrect_count int not null default 0,
  last_seen_at timestamptz,
  primary key (user_id, concept_id)
);

create table public.review_queue (
  user_id uuid not null references public.profiles (id) on delete cascade,
  concept_id text not null references public.concepts (id),
  due_at timestamptz not null,
  priority int not null default 0,
  primary key (user_id, concept_id)
);
create index on public.review_queue (user_id, due_at);

create table public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.xp_event_type not null,
  amount int not null,
  skill_id text references public.skills (id),
  level_id text references public.levels (id),
  concept_id text references public.concepts (id),
  reason text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table public.daily_allowances (
  user_id uuid not null references public.profiles (id) on delete cascade,
  local_date date not null,
  new_levels_used int not null default 0 check (new_levels_used >= 0),
  primary key (user_id, local_date)
);

create table public.entitlements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  entitlement text not null check (entitlement = 'unlimited_learning'),
  active boolean not null default false,
  expires_at timestamptz,
  provider text not null default 'revenuecat',
  provider_customer_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, entitlement)
);

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  level_id text references public.levels (id),
  revision int,
  object_type text not null check (object_type in ('level', 'card', 'question', 'asset')),
  object_id text not null,
  category public.report_category not null,
  message text check (char_length(message) <= 1000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Pure helpers (mirror packages/core)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.knowledge_level(total_cleared int) returns int
language sql immutable as $$ select 1 + floor(sqrt(greatest(total_cleared, 0) * 4))::int $$;

create or replace function public.review_interval(strength int) returns interval
language sql immutable as $$
  select (array[
    interval '10 minutes', interval '1 day', interval '3 days',
    interval '7 days', interval '21 days', interval '60 days'
  ])[least(greatest(strength, 0), 5) + 1]
$$;

create or replace function public.has_unlimited(p_user uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.entitlements
    where user_id = p_user and entitlement = 'unlimited_learning' and active
      and (expires_at is null or expires_at > now())
  )
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Daily allowance
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.daily_status_for(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_tz text;
  v_created timestamptz;
  v_date date;
  v_used int;
  v_cap int;
  v_unlimited boolean := public.has_unlimited(p_user);
  s public.app_settings;
begin
  select * into s from public.app_settings;
  select timezone, created_at into v_tz, v_created from public.profiles where id = p_user;
  if not found then raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002'; end if;

  v_date := (now() at time zone v_tz)::date;
  select coalesce((select new_levels_used from public.daily_allowances where user_id = p_user and local_date = v_date), 0) into v_used;
  v_cap := case when v_date = (v_created at time zone v_tz)::date then s.first_day_new_levels else s.daily_free_new_levels end;

  return jsonb_build_object(
    'local_date', v_date,
    'used', v_used,
    'cap', case when v_unlimited then null else v_cap end,
    'remaining', case when v_unlimited then null else greatest(v_cap - v_used, 0) end,
    'daily_complete', not v_unlimited and v_used >= v_cap,
    'unlimited', v_unlimited
  );
end $$;

create or replace function public.get_daily_status() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  return public.daily_status_for(auth.uid());
end $$;

create or replace function public.progress_summary(p_user uuid, p_skill text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'skill_id', p_skill,
    'skill_level', coalesce(sp.highest_cleared, 0),
    'stars', coalesce(sp.stars, 0),
    'skill_xp', coalesce(sp.total_xp, 0),
    'knowledge_level', public.knowledge_level(
      (select coalesce(sum(highest_cleared), 0)::int from public.user_skill_progress where user_id = p_user)),
    'daily', public.daily_status_for(p_user)
  )
  from (select 1) one
  left join public.user_skill_progress sp on sp.user_id = p_user and sp.skill_id = p_skill
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Start a level: eligibility + the published bundle to render
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.start_level(p_level_id text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_level public.levels;
  v_cleared int;
  v_daily jsonb;
  v_bundle jsonb;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;

  select * into v_level from public.levels where id = p_level_id;
  if not found or v_level.status <> 'published' or v_level.current_revision is null then
    return jsonb_build_object('allowed', false, 'reason', 'LEVEL_NOT_AVAILABLE');
  end if;

  select bundle into v_bundle from public.level_revisions
  where level_id = p_level_id and revision = v_level.current_revision;

  -- Replaying a cleared level is always allowed and never costs allowance.
  if exists (select 1 from public.user_level_progress where user_id = v_uid and level_id = p_level_id and completed_at is not null) then
    return jsonb_build_object('allowed', true, 'reason', 'REPLAY', 'revision', v_level.current_revision, 'bundle', v_bundle);
  end if;

  select coalesce((select highest_cleared from public.user_skill_progress where user_id = v_uid and skill_id = v_level.skill_id), 0)
    into v_cleared;
  if v_level.number <> v_cleared + 1 then
    return jsonb_build_object('allowed', false, 'reason', 'LEVEL_LOCKED');
  end if;

  v_daily := public.daily_status_for(v_uid);
  if (v_daily ->> 'daily_complete')::boolean then
    return jsonb_build_object('allowed', false, 'reason', 'DAILY_COMPLETE', 'daily', v_daily);
  end if;

  insert into public.user_level_progress (user_id, level_id, started_revision)
  values (v_uid, p_level_id, v_level.current_revision)
  on conflict (user_id, level_id) do update set started_at = now(), started_revision = excluded.started_revision;

  return jsonb_build_object('allowed', true, 'reason', 'NEW', 'revision', v_level.current_revision, 'bundle', v_bundle, 'daily', v_daily);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Complete a level: ONE transaction, exactly once per canonical level
-- ─────────────────────────────────────────────────────────────────────────────
--
-- p_answers: [{ "question_id": "question.astronomy.001.q1", "option_id": "b" }, ...]
-- Every question in the level must be answered (wrong answers are fine; they
-- teach, they never block). The server grades; the client never reports scores.
--
-- Errors (SQLSTATE P0001, message is the code):
--   LEVEL_NOT_AVAILABLE, REVISION_NOT_FOUND, LEVEL_LOCKED,
--   DAILY_LIMIT_REACHED, INCOMPLETE_ANSWERS

create or replace function public.complete_level(
  p_level_id text,
  p_revision int,
  p_answers jsonb,
  p_idempotency_key uuid
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  s public.app_settings;
  v_level public.levels;
  v_cleared int;
  v_daily jsonb;
  v_date date;
  v_correct int := 0;
  v_total int := 0;
  v_bonus int;
  v_xp int;
  v_is_mastery boolean;
  q record;
  v_concept text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_idempotency_key is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = '22023'; end if;

  -- Serialize this user's completions so double taps can't race.
  perform 1 from public.profiles where id = v_uid for update;
  if not found then raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002'; end if;

  select * into s from public.app_settings;
  select * into v_level from public.levels where id = p_level_id;
  if not found or v_level.status <> 'published' then raise exception 'LEVEL_NOT_AVAILABLE'; end if;
  if not exists (select 1 from public.level_revisions where level_id = p_level_id and revision = p_revision) then
    raise exception 'REVISION_NOT_FOUND';
  end if;

  -- Exactly once: a second completion (same or different key) awards nothing.
  if exists (select 1 from public.user_level_progress where user_id = v_uid and level_id = p_level_id and completed_at is not null) then
    return public.progress_summary(v_uid, v_level.skill_id)
      || jsonb_build_object('level_id', p_level_id, 'already_completed', true, 'xp_awarded', 0);
  end if;

  insert into public.user_skill_progress (user_id, skill_id) values (v_uid, v_level.skill_id) on conflict do nothing;
  select highest_cleared into v_cleared from public.user_skill_progress
  where user_id = v_uid and skill_id = v_level.skill_id for update;
  if v_level.number <> v_cleared + 1 then raise exception 'LEVEL_LOCKED'; end if;

  v_daily := public.daily_status_for(v_uid);
  if (v_daily ->> 'daily_complete')::boolean then raise exception 'DAILY_LIMIT_REACHED'; end if;
  v_date := (v_daily ->> 'local_date')::date;

  -- Every question in the level must have a submitted answer.
  if exists (
    select 1 from public.questions qq
    where qq.level_id = p_level_id
      and not exists (select 1 from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) a where a ->> 'question_id' = qq.id)
  ) then
    raise exception 'INCOMPLETE_ANSWERS';
  end if;

  -- Concepts first seen in this level: tested ones start at 0, untested at 1 (due tomorrow).
  insert into public.user_concept_mastery (user_id, concept_id, strength)
  select v_uid, lc.concept_id,
         case when exists (select 1 from public.question_concepts qc join public.questions qq on qq.id = qc.question_id
                           where qq.level_id = p_level_id and qc.concept_id = lc.concept_id) then 0 else 1 end
  from public.level_concepts lc where lc.level_id = p_level_id
  on conflict do nothing;

  -- Grade server-side. First submitted answer per question counts.
  for q in
    select qq.id, coalesce(o.correct, false) as correct
    from public.questions qq
    cross join lateral (
      select a ->> 'option_id' as option_id
      from jsonb_array_elements(p_answers) with ordinality as t(a, i)
      where a ->> 'question_id' = qq.id order by i limit 1
    ) ans
    left join public.answer_options o on o.question_id = qq.id and o.option_id = ans.option_id
    where qq.level_id = p_level_id
    order by qq.id
  loop
    v_total := v_total + 1;
    if q.correct then v_correct := v_correct + 1; end if;
    for v_concept in select concept_id from public.question_concepts where question_id = q.id loop
      update public.user_concept_mastery m set
        strength = case when q.correct then least(m.strength + 1, 5) else 0 end,
        correct_count = m.correct_count + q.correct::int,
        incorrect_count = m.incorrect_count + (not q.correct)::int
      where m.user_id = v_uid and m.concept_id = v_concept;
    end loop;
  end loop;

  update public.user_concept_mastery m set seen_count = m.seen_count + 1, last_seen_at = now()
  from public.level_concepts lc
  where lc.level_id = p_level_id and m.user_id = v_uid and m.concept_id = lc.concept_id;

  insert into public.review_queue (user_id, concept_id, due_at)
  select v_uid, m.concept_id, now() + public.review_interval(m.strength)
  from public.user_concept_mastery m
  join public.level_concepts lc on lc.concept_id = m.concept_id and lc.level_id = p_level_id
  where m.user_id = v_uid
  on conflict (user_id, concept_id) do update set due_at = excluded.due_at;

  -- XP ledger. Unique (user_id, idempotency_key) makes each award exactly-once.
  v_bonus := least(v_correct * s.xp_question_correct, s.xp_question_correct_cap);
  v_is_mastery := v_level.number % s.mastery_band_size = 0;
  v_xp := s.xp_level_complete + v_bonus + case when v_is_mastery then s.xp_mastery_clear else 0 end;

  insert into public.xp_events (user_id, type, amount, skill_id, level_id, reason, idempotency_key) values
    (v_uid, 'LEVEL_COMPLETE', s.xp_level_complete, v_level.skill_id, p_level_id, 'first completion', 'level_complete:' || p_level_id);
  if v_bonus > 0 then
    insert into public.xp_events (user_id, type, amount, skill_id, level_id, reason, idempotency_key) values
      (v_uid, 'QUESTION_CORRECT', v_bonus, v_level.skill_id, p_level_id, v_correct || '/' || v_total || ' correct', 'question_bonus:' || p_level_id);
  end if;
  if v_is_mastery then
    insert into public.xp_events (user_id, type, amount, skill_id, level_id, reason, idempotency_key) values
      (v_uid, 'MASTERY_CLEAR', s.xp_mastery_clear, v_level.skill_id, p_level_id, 'mastery checkpoint', 'mastery:' || p_level_id);
  end if;

  update public.user_skill_progress set
    highest_cleared = v_level.number,
    stars = v_level.number / s.mastery_band_size,
    total_xp = total_xp + v_xp,
    updated_at = now()
  where user_id = v_uid and skill_id = v_level.skill_id;

  insert into public.user_level_progress (user_id, level_id, completed_at, completed_revision, correct_count, question_count, idempotency_key, started_revision)
  values (v_uid, p_level_id, now(), p_revision, v_correct, v_total, p_idempotency_key, p_revision)
  on conflict (user_id, level_id) do update set
    completed_at = excluded.completed_at,
    completed_revision = excluded.completed_revision,
    correct_count = excluded.correct_count,
    question_count = excluded.question_count,
    idempotency_key = excluded.idempotency_key;

  insert into public.daily_allowances (user_id, local_date, new_levels_used) values (v_uid, v_date, 1)
  on conflict (user_id, local_date) do update set new_levels_used = public.daily_allowances.new_levels_used + 1;

  return public.progress_summary(v_uid, v_level.skill_id) || jsonb_build_object(
    'level_id', p_level_id,
    'already_completed', false,
    'skill_level_before', v_cleared,
    'correct', v_correct,
    'total', v_total,
    'xp_awarded', v_xp,
    'mastery_cleared', v_is_mastery
  );
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security & grants
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.app_settings enable row level security;
alter table public.subjects enable row level security;
alter table public.skills enable row level security;
alter table public.sources enable row level security;
alter table public.assets enable row level security;
alter table public.concepts enable row level security;
alter table public.levels enable row level security;
alter table public.level_revisions enable row level security;
alter table public.level_concepts enable row level security;
alter table public.questions enable row level security;
alter table public.question_concepts enable row level security;
alter table public.answer_options enable row level security;
alter table public.source_links enable row level security;
alter table public.profiles enable row level security;
alter table public.user_skill_progress enable row level security;
alter table public.user_level_progress enable row level security;
alter table public.user_concept_mastery enable row level security;
alter table public.review_queue enable row level security;
alter table public.xp_events enable row level security;
alter table public.daily_allowances enable row level security;
alter table public.entitlements enable row level security;
alter table public.content_reports enable row level security;

-- Published curriculum is world-readable. Writes happen via the service role (importer/admin).
create policy "read settings" on public.app_settings for select using (true);
create policy "read published subjects" on public.subjects for select using (status = 'published');
create policy "read published skills" on public.skills for select using (status = 'published');
create policy "read sources" on public.sources for select using (true);
create policy "read assets" on public.assets for select using (true);
create policy "read concepts" on public.concepts for select using (true);
create policy "read published levels" on public.levels for select using (status = 'published');
create policy "read published revisions" on public.level_revisions for select
  using (exists (select 1 from public.levels l where l.id = level_id and l.status = 'published'));
create policy "read published level concepts" on public.level_concepts for select
  using (exists (select 1 from public.levels l where l.id = level_id and l.status = 'published'));
create policy "read published questions" on public.questions for select
  using (exists (select 1 from public.levels l where l.id = level_id and l.status = 'published'));
create policy "read question concepts" on public.question_concepts for select
  using (exists (select 1 from public.questions q join public.levels l on l.id = q.level_id where q.id = question_id and l.status = 'published'));
create policy "read answer options" on public.answer_options for select
  using (exists (select 1 from public.questions q join public.levels l on l.id = q.level_id where q.id = question_id and l.status = 'published'));
create policy "read source links" on public.source_links for select using (true);

-- Users read only their own progress. No insert/update/delete policies: progress
-- changes only through the security-definer functions above.
create policy "own profile" on public.profiles for select using (id = auth.uid());
create policy "update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "own skill progress" on public.user_skill_progress for select using (user_id = auth.uid());
create policy "own level progress" on public.user_level_progress for select using (user_id = auth.uid());
create policy "own mastery" on public.user_concept_mastery for select using (user_id = auth.uid());
create policy "own review queue" on public.review_queue for select using (user_id = auth.uid());
create policy "own xp" on public.xp_events for select using (user_id = auth.uid());
create policy "own allowance" on public.daily_allowances for select using (user_id = auth.uid());
create policy "own entitlements" on public.entitlements for select using (user_id = auth.uid());
create policy "own reports" on public.content_reports for select using (user_id = auth.uid());
create policy "file reports" on public.content_reports for insert with check (user_id = auth.uid() and status = 'open');

-- Only display_name and timezone are user-editable (created_at drives the first-day bonus).
revoke update on public.profiles from anon, authenticated;
grant update (display_name, timezone) on public.profiles to authenticated;

revoke execute on function public.daily_status_for(uuid) from public, anon, authenticated;
revoke execute on function public.progress_summary(uuid, text) from public, anon, authenticated;
revoke execute on function public.has_unlimited(uuid) from public, anon, authenticated;
revoke execute on function public.complete_level(text, int, jsonb, uuid) from public, anon;
revoke execute on function public.start_level(text) from public, anon;
revoke execute on function public.get_daily_status() from public, anon;
grant execute on function public.complete_level(text, int, jsonb, uuid) to authenticated;
grant execute on function public.start_level(text) to authenticated;
grant execute on function public.get_daily_status() to authenticated;
