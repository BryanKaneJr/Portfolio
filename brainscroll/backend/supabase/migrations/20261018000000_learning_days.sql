-- Learning days, dated when they happen (owner, 2026-09-30).
--
-- The streak and its trophies used to date every past lesson and review
-- with the learner's CURRENT time zone, so changing time zone could merge
-- two days (or split one) and take a streak trophy away, which must never
-- happen. Each learning day is now recorded as it happens, in the time zone
-- the learner is in at that moment, and never recomputed: a first clear or
-- a scheduled review answer notes its day (triggers below). Later time zone
-- changes and content corrections leave past days alone. The streak and the
-- streak trophies read these days. Mirrors core `learningDays`.

create table public.user_learning_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  first_at timestamptz not null,
  primary key (user_id, day)
);
alter table public.user_learning_days enable row level security;
create policy "own learning days" on public.user_learning_days for select using (user_id = auth.uid());

-- Note a learning moment on the day it is for the learner right now.
create or replace function public.note_learning_day(p_uid uuid, p_at timestamptz) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.user_learning_days (user_id, day, first_at)
  values (p_uid, (p_at at time zone coalesce((select timezone from public.profiles where id = p_uid), 'UTC'))::date, p_at)
  on conflict (user_id, day) do update set first_at = least(user_learning_days.first_at, excluded.first_at)
$$;
revoke execute on function public.note_learning_day(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.tg_learning_day_level() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.completed_at is not null and (tg_op = 'INSERT' or old.completed_at is null) then
    perform public.note_learning_day(new.user_id, new.completed_at);
  end if;
  return new;
end $$;
create trigger learning_day_level after insert or update of completed_at on public.user_level_progress
  for each row execute function public.tg_learning_day_level();

create or replace function public.tg_learning_day_review() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.note_learning_day(new.user_id, new.first_attempted_at);
  return new;
end $$;
create trigger learning_day_review after insert on public.user_review_attempts
  for each row execute function public.tg_learning_day_review();

-- Rebuild one learner's days from their clears and reviews, in their current
-- time zone: the one-time backfill below, and tests that move history in time.
create or replace function public.rebuild_learning_days(p_uid uuid) returns void
language sql security definer set search_path = public, pg_temp as $$
  delete from public.user_learning_days where user_id = p_uid;
  insert into public.user_learning_days (user_id, day, first_at)
  select p_uid, (a.at at time zone coalesce((select timezone from public.profiles where id = p_uid), 'UTC'))::date, min(a.at)
  from (
    select completed_at as at from public.user_level_progress where user_id = p_uid and completed_at is not null
    union all
    select first_attempted_at from public.user_review_attempts where user_id = p_uid
  ) a
  group by 2;
$$;
revoke execute on function public.rebuild_learning_days(uuid) from public, anon, authenticated;

-- Backfill: existing history, dated in each learner's current time zone (the best record there is).
select public.rebuild_learning_days(id) from public.profiles;

create or replace function public.learning_streak(p_user uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with tz as (
    select coalesce(timezone, 'UTC') as tz from public.profiles where id = p_user
  ), today as (
    select (now() at time zone (select tz from tz))::date as d
  ), days as (
    -- Each learning day as it was dated when the learning happened (user_learning_days).
    select day as d from public.user_learning_days where user_id = p_user
  ), runs as (
    select d, d - (row_number() over (order by d))::int as grp from days
  ), islands as (
    select max(d) as last_day, count(*)::int as n from runs group by grp
  )
  select jsonb_build_object(
    'current', coalesce((select n from islands where last_day >= (select d from today) - 1 order by last_day desc limit 1), 0),
    'longest', coalesce((select max(n) from islands), 0),
    'today', exists (select 1 from days where d = (select d from today))
  )
$$;
revoke execute on function public.learning_streak(uuid) from public, anon, authenticated;

create or replace function public.milestone_trophies(p_uid uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with lc as (
    select e.created_at, e.skill_id, l.number, s.subject_id, row_number() over (order by e.created_at, e.id) as n
    from public.xp_events e
    join public.levels l on l.id = e.level_id
    join public.skills s on s.id = e.skill_id
    where e.user_id = p_uid and e.type = 'LEVEL_COMPLETE'
  ),
  nth as (select created_at, row_number() over (order by created_at) as n from lc),
  rv as (select created_at, row_number() over (order by created_at, id) as n from public.xp_events where user_id = p_uid and type = 'DELAYED_RECALL'),
  perfect as (
    select completed_at, row_number() over (order by completed_at, level_id) as n from public.user_level_progress
    where user_id = p_uid and completed_at is not null and question_count > 0 and correct_count = question_count
  ),
  chapters as (select created_at, row_number() over (order by created_at) as n from lc where number % 10 = 0),
  quests as (select earned_at, row_number() over (order by earned_at) as n from public.user_trophies where user_id = p_uid and quest_id is not null),
  skill_first as (select skill_id, min(created_at) as at from lc group by skill_id),
  skill_first_n as (select at, row_number() over (order by at) as n from skill_first),
  tens as (select skill_id, min(created_at) as at from lc where number = 10 group by skill_id),
  hundreds as (select skill_id, min(created_at) as at from lc where number = 100 group by skill_id),
  fifties as (select skill_id, min(created_at) as at from lc where number = 50 group by skill_id),
  -- Shipped skills: those with published levels (skill rows themselves can stay draft in production).
  published as (select s.id, s.subject_id from public.skills s where exists (select 1 from public.levels l where l.skill_id = s.id and l.status = 'published')),
  subject_first as (select subject_id, min(created_at) as at from lc group by subject_id),
  -- Streaks: the learning days of learning_streak() (user_learning_days), each with its first learning, grouped into runs.
  sdays as (select day as d, first_at as at from public.user_learning_days where user_id = p_uid),
  sruns as (select d, at, d - (row_number() over (order by d))::int as grp from sdays),
  sk as (select at, row_number() over (partition by grp order by d) as k from sruns),
  fixed (trophy_id, earned_at) as (
    select 'trophy.first_level', (select created_at from nth where n = 1)
    union all select 'trophy.warming_up', (select created_at from nth where n = 25)
    union all select 'trophy.century', (select created_at from nth where n = 100)
    union all select 'trophy.five_hundred', (select created_at from nth where n = 500)
    union all select 'trophy.thousand', (select created_at from nth where n = 1000)
    union all select 'trophy.chapter_one', (select min(created_at) from lc where number = 10)
    union all select 'trophy.ten_chapters', (select created_at from chapters where n = 10)
    union all select 'trophy.fifty_chapters', (select created_at from chapters where n = 50)
    union all select 'trophy.halfway', (select min(created_at) from lc where number = 50)
    union all select 'trophy.mastered', (select min(created_at) from lc where number = 100)
    union all select 'trophy.perfect_' || t, (select completed_at from perfect where n = t)
      from unnest(array[10, 25, 50, 75, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]) t
    union all select 'trophy.jack_of_all_trades', (select case when count(f.at) = count(*) and count(*) > 0 then max(f.at) end
                                                   from published p left join fifties f on f.skill_id = p.id)
    union all select 'trophy.master_of_all', (select case when count(h.at) = count(*) and count(*) > 0 then max(h.at) end
                                              from published p left join hundreds h on h.skill_id = p.id)
    union all select 'trophy.long_memory', (select created_at from rv where n = 100)
    union all select 'trophy.steel_trap', (select created_at from rv where n = 500)
    union all select 'trophy.curious', (select at from skill_first_n where n = 10)
    union all select 'trophy.explorer', (select case when count(f.at) = count(*) and count(*) > 0 then max(f.at) end
                                         from published p left join skill_first f on f.skill_id = p.id)
    union all select 'trophy.well_rounded', (select at from tens order by at offset 4 limit 1)
    union all select 'trophy.polymath', (select case when count(f.at) = count(*) and count(*) > 0 then max(f.at) end
                                         from (select distinct subject_id from published) s left join subject_first f on f.subject_id = s.subject_id)
    union all select 'trophy.quest_regular', (select earned_at from quests where n = 3)
    union all select 'trophy.quest_veteran', (select earned_at from quests where n = 10)
    union all select 'trophy.streak_' || t, (select min(at) from sk where k = t)
      from unnest(array[7, 30, 100, 365, 500, 1000]) t
  ),
  all_trophies (trophy_id, kind, earned_at) as (
    select trophy_id, 'milestone', earned_at from fixed
    union all
    select 'trophy.mastery_' || split_part(h.skill_id, '.', 3), 'mastery', h.at
    from hundreds h join published p on p.id = h.skill_id
    union all
    select 'trophy.subject_' || split_part(s.subject_id, '.', 2), 'subject', max(h.at)
    from published s left join hundreds h on h.skill_id = s.id
    group by s.subject_id having count(h.at) = count(*)
  )
  select coalesce(jsonb_agg(jsonb_build_object('trophy_id', trophy_id, 'kind', kind, 'earned_at', earned_at) order by earned_at, trophy_id), '[]')
  from all_trophies where earned_at is not null
$$;
revoke execute on function public.milestone_trophies(uuid) from public, anon, authenticated;
