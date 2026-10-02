-- Brainpower (owner, 2026-10-02): the pacing for free learners, replacing the
-- flat daily cap of new levels. "Brainpower lets you learn something new."
--
-- - Free learners refill to 5 at the start of each local day; more than 5 is
--   kept. They hold at most 10; anything earned at 10 is lost, never banked.
-- - A new level needs 1 to start and spends it when it's cleared (leaving a
--   level never wastes any: it starts over, docs/specs CURRENT_PRODUCT_DECISIONS).
--   Nothing else costs Brainpower: review, chapter reviews, replays, social.
-- - Earned, once per thing (brainpower_awards):
--     streak:<day>               the first learning of a day that extends a
--                                streak (day 2 and on: yesterday was a learning day)
--     trophy:<trophy id>         every trophy
--     chapter:<skill>:<chapter>  the first completed review of each chapter
--     perfect:<level>            10% of perfect first clears (truly random, no pity)
-- - Unlimited holds ∞: never spends, and its awards are recorded at 0 so a
--   lapsed subscription never pays out a backlog.
--
-- The balance is a small mutable record (not XP; the XP ledger is unchanged).
-- Its day refill is applied lazily: daily_status_for reads it virtually, and
-- the next write materialises it. Mirrors core `brainpower.ts`.
--
-- The existing cap plumbing stays: daily_status_for is still the one gate
-- (start_level and complete_level read `daily_complete`, now "no Brainpower"),
-- and the first-clear tally in daily_allowances is where a level spends.

alter table public.app_settings
  add column brainpower_daily_refill int not null default 5 check (brainpower_daily_refill >= 0),
  add column brainpower_max int not null default 10 check (brainpower_max >= 1),
  add column brainpower_perfect_drop_percent int not null default 10 check (brainpower_perfect_drop_percent between 0 and 100);

create table public.user_brainpower (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance int not null check (balance >= 0),
  -- The local day `balance` is for. An earlier day means the refill is due.
  as_of date not null
);
alter table public.user_brainpower enable row level security;

create table public.brainpower_awards (
  user_id uuid not null references public.profiles (id) on delete cascade,
  award_key text not null,
  kind text not null check (kind in ('streak', 'trophy', 'chapter_review', 'perfect')),
  -- 1 when it raised the balance; 0 when it was full, on Unlimited, or seeded at launch.
  granted int not null default 0 check (granted in (0, 1)),
  created_at timestamptz not null default now(),
  primary key (user_id, award_key)
);
alter table public.brainpower_awards enable row level security;

-- The learner's local day now (the same day the daily status uses).
create or replace function public.brainpower_today(p_uid uuid) returns date
language sql stable security definer set search_path = public, pg_temp as $$
  select (now() at time zone coalesce((select timezone from public.profiles where id = p_uid), 'UTC'))::date
$$;

-- The balance right now, with today's refill applied. New learners start at the refill.
create or replace function public.brainpower_balance(p_uid uuid) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    (select case when b.as_of < public.brainpower_today(p_uid) then greatest(b.balance, s.brainpower_daily_refill) else b.balance end
     from public.user_brainpower b where b.user_id = p_uid),
    s.brainpower_daily_refill)
  from public.app_settings s
$$;

-- Materialise today's balance (refill included) and lock it for a change.
create or replace function public.brainpower_lock(p_uid uuid) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare v int;
begin
  v := public.brainpower_balance(p_uid);
  insert into public.user_brainpower (user_id, balance, as_of) values (p_uid, v, public.brainpower_today(p_uid))
  on conflict (user_id) do update set balance = v, as_of = excluded.as_of;
  perform 1 from public.user_brainpower where user_id = p_uid for update;
  return v;
end $$;

-- A new level was cleared: spend 1 (Unlimited spends nothing).
create or replace function public.brainpower_spend(p_uid uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v int;
begin
  if public.has_unlimited(p_uid) then return; end if;
  v := public.brainpower_lock(p_uid);
  update public.user_brainpower set balance = greatest(v - 1, 0) where user_id = p_uid;
end $$;

-- Award one thing, once ever. +1 unless full (or on Unlimited, where it's noted at 0).
create or replace function public.brainpower_grant(p_uid uuid, p_key text, p_kind text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v int;
  v_max int := (select brainpower_max from public.app_settings);
begin
  insert into public.brainpower_awards (user_id, award_key, kind) values (p_uid, p_key, p_kind)
  on conflict (user_id, award_key) do nothing;
  if not found or public.has_unlimited(p_uid) then return; end if;
  v := public.brainpower_lock(p_uid);
  if v < v_max then
    update public.user_brainpower set balance = v + 1 where user_id = p_uid;
    update public.brainpower_awards set granted = 1 where user_id = p_uid and award_key = p_key;
  end if;
end $$;

-- Every trophy earned so far (milestones, mastery, subjects, and Weekly Quest trophies).
create or replace function public.brainpower_trophy_ids(p_uid uuid) returns setof text
language sql stable security definer set search_path = public, pg_temp as $$
  select x ->> 'trophy_id' from jsonb_array_elements(public.milestone_trophies(p_uid)) x
  union
  select trophy_id from public.user_trophies where user_id = p_uid
$$;

create or replace function public.brainpower_sync_trophies(p_uid uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare t text;
begin
  for t in select * from public.brainpower_trophy_ids(p_uid) order by 1 loop
    perform public.brainpower_grant(p_uid, 'trophy:' || t, 'trophy');
  end loop;
end $$;

-- After a learning moment today: the streak award (if yesterday was a learning
-- day too), then any trophies it completed.
create or replace function public.brainpower_after_learning(p_uid uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_today date := public.brainpower_today(p_uid);
begin
  if exists (select 1 from public.user_learning_days where user_id = p_uid and day = v_today - 1) then
    perform public.brainpower_grant(p_uid, 'streak:' || v_today, 'streak');
  end if;
  perform public.brainpower_sync_trophies(p_uid);
end $$;

-- A first clear (complete_level's daily tally): spend first, so a full learner
-- still gets what this level earns, then the streak, a perfect drop and trophies.
create or replace function public.tg_brainpower_level() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  lp public.user_level_progress;
  v_pct int := (select brainpower_perfect_drop_percent from public.app_settings);
begin
  if tg_op = 'UPDATE' and new.new_levels_used <= old.new_levels_used then return new; end if;
  perform public.brainpower_spend(new.user_id);
  -- The level cleared in this transaction.
  for lp in select * from public.user_level_progress where user_id = new.user_id and completed_at = now() loop
    if lp.question_count > 0 and lp.correct_count = lp.question_count and random() * 100 < v_pct then
      perform public.brainpower_grant(new.user_id, 'perfect:' || lp.level_id, 'perfect');
    end if;
  end loop;
  perform public.brainpower_after_learning(new.user_id);
  return new;
end $$;
create trigger brainpower_level after insert or update of new_levels_used on public.daily_allowances
  for each row execute function public.tg_brainpower_level();

-- A scheduled review answer is a learning moment too. Named to run after
-- learning_day_review, so today's learning day is already noted.
create or replace function public.tg_brainpower_review() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.brainpower_after_learning(new.user_id);
  return new;
end $$;
create trigger zz_brainpower_review after insert on public.user_review_attempts
  for each row execute function public.tg_brainpower_review();

-- Review XP counts toward trophies (Long Memory); it can land after the answer row.
create or replace function public.tg_brainpower_xp() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.type = 'DELAYED_RECALL' then perform public.brainpower_sync_trophies(new.user_id); end if;
  return new;
end $$;
create trigger brainpower_xp after insert on public.xp_events
  for each row execute function public.tg_brainpower_xp();

-- The first completed review of each chapter.
create or replace function public.tg_brainpower_chapter_review() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.completed_at is not null and old.completed_at is null then
    perform public.brainpower_grant(new.user_id, 'chapter:' || new.skill_id || ':' || new.chapter, 'chapter_review');
    perform public.brainpower_sync_trophies(new.user_id);
  end if;
  return new;
end $$;
create trigger brainpower_chapter_review after update of completed_at on public.user_chapter_reviews
  for each row execute function public.tg_brainpower_chapter_review();

-- Weekly Quest trophies.
create or replace function public.tg_brainpower_trophy() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.brainpower_sync_trophies(new.user_id);
  return new;
end $$;
create trigger brainpower_trophy after insert on public.user_trophies
  for each row execute function public.tg_brainpower_trophy();

-- The one gate, now Brainpower. Same shape as before, so callers keep working:
-- `remaining` is the balance, `cap` the capacity, `daily_complete` "none left".
-- `brainpower_earned` lists what this transaction awarded (complete_level's
-- summary shows it; a plain status read has none).
create or replace function public.daily_status_for(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_date date;
  v_used int;
  v_balance int;
  v_unlimited boolean := public.has_unlimited(p_user);
  s public.app_settings;
begin
  select * into s from public.app_settings;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002'; end if;
  v_date := public.brainpower_today(p_user);
  select coalesce((select new_levels_used from public.daily_allowances where user_id = p_user and local_date = v_date), 0) into v_used;
  v_balance := public.brainpower_balance(p_user);

  return jsonb_build_object(
    'local_date', v_date,
    'used', v_used,
    'cap', case when v_unlimited then null else s.brainpower_max end,
    'remaining', case when v_unlimited then null else v_balance end,
    'daily_complete', not v_unlimited and v_balance < 1,
    'unlimited', v_unlimited,
    'brainpower', case when v_unlimited then null else v_balance end,
    'brainpower_max', s.brainpower_max,
    'brainpower_refill', s.brainpower_daily_refill,
    'brainpower_earned', coalesce((
      select jsonb_agg(jsonb_build_object('kind', a.kind, 'key', a.award_key, 'granted', a.granted) order by a.award_key)
      from public.brainpower_awards a where a.user_id = p_user and a.created_at = now()), '[]'::jsonb)
  );
end $$;

revoke execute on function
  public.brainpower_today(uuid), public.brainpower_balance(uuid), public.brainpower_lock(uuid), public.brainpower_spend(uuid),
  public.brainpower_grant(uuid, text, text), public.brainpower_trophy_ids(uuid), public.brainpower_sync_trophies(uuid),
  public.brainpower_after_learning(uuid), public.daily_status_for(uuid)
from public, anon, authenticated;
revoke execute on function
  public.tg_brainpower_level(), public.tg_brainpower_review(), public.tg_brainpower_xp(),
  public.tg_brainpower_chapter_review(), public.tg_brainpower_trophy()
from public, anon, authenticated;

-- complete_chapter_review (as in 20261016000000), now also returning the
-- daily status, so the app can show the +1 the first review of a chapter pays.
create or replace function public.complete_chapter_review(p_review_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_max int := (select xp_chapter_review_max from public.app_settings);
  v_total int;
  v_right int;
  v_xp int;
  v_credit boolean;
  v_inserted int;
  r public.user_chapter_reviews;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  perform 1 from public.profiles where id = v_uid for update;
  select * into r from public.user_chapter_reviews where id = p_review_id and user_id = v_uid for update;
  if r.id is null then raise exception 'REVIEW_NOT_FOUND'; end if;

  -- Only questions that still exist (a content correction can remove one).
  select count(*), count(*) filter (where a.first_attempt_correct)
  into v_total, v_right
  from unnest(r.question_ids) x(id)
  join public.questions q on q.id = x.id
  left join public.user_chapter_review_answers a on a.review_id = r.id and a.question_id = x.id;

  if r.completed_at is not null then
    return jsonb_build_object('review_id', r.id, 'skill_id', r.skill_id, 'chapter', r.chapter, 'xp_awarded', 0,
      'first_attempt_correct', v_right, 'total', v_total, 'already_completed', true,
      'quest_credit', exists (select 1 from public.xp_events where user_id = v_uid
                              and idempotency_key = 'chapter_review:' || r.id and reason = 'no_new_levels'));
  end if;
  if exists (select 1 from unnest(r.question_ids) x(id)
             join public.questions q on q.id = x.id
             left join public.user_chapter_review_answers a on a.review_id = r.id and a.question_id = x.id
             where a.resolved_at is null) then
    raise exception 'REVIEW_UNRESOLVED';
  end if;

  v_xp := case when v_total > 0 then round(v_max * v_right::numeric / v_total)::int else 0 end;
  -- Nothing new left in this skill for the learner: the review counts toward quests.
  v_credit := coalesce((select highest_cleared from public.user_skill_progress where user_id = v_uid and skill_id = r.skill_id), 0)
              >= coalesce((select max(number) from public.levels where skill_id = r.skill_id and status = 'published'), 0)
              -- Nothing answered (every question removed since it started): no quest credit.
              and v_total > 0;
  update public.user_chapter_reviews set completed_at = now(), xp_awarded = v_xp where id = r.id;
  insert into public.xp_events (user_id, type, amount, skill_id, level_id, reason, idempotency_key)
  values (v_uid, 'CHAPTER_REVIEW', v_xp, r.skill_id,
          (select id from public.levels where skill_id = r.skill_id and number = r.chapter * 10),
          case when v_credit then 'no_new_levels' else 'chapter_review' end, 'chapter_review:' || r.id)
  on conflict (user_id, idempotency_key) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted > 0 and v_xp > 0 then
    update public.user_skill_progress set total_xp = total_xp + v_xp, updated_at = now()
    where user_id = v_uid and skill_id = r.skill_id;
  end if;
  return jsonb_build_object('review_id', r.id, 'skill_id', r.skill_id, 'chapter', r.chapter, 'xp_awarded', v_xp * v_inserted,
    'first_attempt_correct', v_right, 'total', v_total, 'already_completed', false, 'quest_credit', v_credit,
    -- Brainpower now: the first review of a chapter pays +1 (tg_brainpower_chapter_review).
    'daily', public.daily_status_for(v_uid));
end $$;

-- Launch: everyone starts at a full day's refill, and what they've already
-- earned is noted at 0, so the first action after this ships pays nothing old.
insert into public.user_brainpower (user_id, balance, as_of)
select p.id, (select brainpower_daily_refill from public.app_settings), public.brainpower_today(p.id) from public.profiles p
on conflict do nothing;
insert into public.brainpower_awards (user_id, award_key, kind)
select p.id, 'trophy:' || t, 'trophy' from public.profiles p, lateral public.brainpower_trophy_ids(p.id) t
on conflict do nothing;
insert into public.brainpower_awards (user_id, award_key, kind)
select distinct user_id, 'chapter:' || skill_id || ':' || chapter, 'chapter_review' from public.user_chapter_reviews where completed_at is not null
on conflict do nothing;
