-- Milestone trophies (packages/core/src/trophies.ts): derived from progress
-- that already exists, never stored. Each is dated by the moment it was
-- reached: the first clear, a Level 10 / 50 / 100, Level 10 in five skills, a
-- level in every subject, 100 and 500 levels, 100 first-try reviews.
create or replace function public.milestone_trophies(p_uid uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with lc as (
    select e.created_at, e.skill_id, l.number, s.subject_id, row_number() over (order by e.created_at, e.id) as n
    from public.xp_events e
    join public.levels l on l.id = e.level_id
    join public.skills s on s.id = e.skill_id
    where e.user_id = p_uid and e.type = 'LEVEL_COMPLETE'
  ),
  rv as (
    select created_at, row_number() over (order by created_at, id) as n
    from public.xp_events where user_id = p_uid and type = 'DELAYED_RECALL'
  ),
  tens as (select skill_id, min(created_at) as at from lc where number = 10 group by skill_id),
  subj as (select subject_id, min(created_at) as at from lc group by subject_id),
  t (trophy_id, earned_at) as (
    select 'trophy.first_level', (select created_at from lc where n = 1)
    union all select 'trophy.chapter_one', (select min(created_at) from lc where number = 10)
    union all select 'trophy.halfway', (select min(created_at) from lc where number = 50)
    union all select 'trophy.mastered', (select min(created_at) from lc where number = 100)
    union all select 'trophy.well_rounded', (select at from tens order by at offset 4 limit 1)
    union all select 'trophy.polymath', (select case when count(*) >= (select count(distinct subject_id) from public.skills where status = 'published') then max(at) end from subj)
    union all select 'trophy.century', (select created_at from lc where n = 100)
    union all select 'trophy.five_hundred', (select created_at from lc where n = 500)
    union all select 'trophy.long_memory', (select created_at from rv where n = 100)
  )
  select coalesce(jsonb_agg(jsonb_build_object('trophy_id', trophy_id, 'kind', 'milestone', 'earned_at', earned_at) order by earned_at), '[]')
  from t where earned_at is not null
$$;
revoke execute on function public.milestone_trophies(uuid) from public, anon, authenticated;

-- get_quests now returns the whole shelf: quest trophies (stored) and milestones (derived).
create or replace function public.get_quests() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  return jsonb_build_object(
    'now', now(),
    'quests', (select coalesce(jsonb_agg(public.quest_view(v_uid, q) order by q.starts_at desc), '[]')
               from public.quests q where q.status = 'published' and q.starts_at <= now()),
    'trophies', (select coalesce(jsonb_agg(x order by x ->> 'earned_at' desc), '[]') from (
                   select jsonb_build_object('trophy_id', t.trophy_id, 'name', t.name, 'kind', 'quest', 'quest_id', t.quest_id, 'earned_at', t.earned_at) as x
                   from public.user_trophies t where t.user_id = v_uid
                   union all
                   select m from jsonb_array_elements(public.milestone_trophies(v_uid)) m
                 ) shelf));
end $$;
