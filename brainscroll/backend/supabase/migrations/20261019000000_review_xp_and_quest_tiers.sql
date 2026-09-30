-- Owner, 2026-09-30:
-- 1. A chapter review pays up to 30 XP (was 15), still scaled by first tries.
--    Mirrors XP.CHAPTER_REVIEW_MAX (core).
-- 2. Quest trophies come in five tiers of weeks: 1, 4, 10, 25 and 52 quests
--    finished in their week (was 3 and 10). Mirrors QUEST_TROPHY_TIERS (core).
--    Derived, never stored, so there is nothing to migrate.

alter table public.app_settings alter column xp_chapter_review_max set default 30;
update public.app_settings set xp_chapter_review_max = 30;
comment on column public.app_settings.xp_chapter_review_max is
  'Most XP a chapter review pays (owner, 2026-09-30: 30). Mirrors XP.CHAPTER_REVIEW_MAX (core).';

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
    union all select 'trophy.quests_' || t, (select earned_at from quests where n = t)
      from unnest(array[1, 4, 10, 25, 52]) t
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
