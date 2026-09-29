-- Quest titles and emblems: a live-week quest clear (the quest trophy) also
-- unlocks that quest's title ("Citizen of Rome") and its emblem (the quest's
-- art) to show on Profile. Nothing new is stored about earning them: they
-- follow from user_trophies. The only new state is what the learner chose to
-- show, validated here; the client can't write these columns.
alter table public.quests add column title_reward text;
alter table public.profiles
  add column equipped_title_quest text references public.quests (id) on delete set null,
  add column equipped_emblem_quest text references public.quests (id) on delete set null;

create or replace function public.import_quests(p jsonb, p_publish_drafts boolean default false) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  x jsonb;
  n int := 0;
begin
  for x in select * from jsonb_array_elements(coalesce(p, '[]')) loop
    n := n + 1;
    insert into public.quests (id, title, tagline, art, starts_at, ends_at, xp_reward, trophy_id, trophy_name, title_reward, status)
    values (x ->> 'id', x ->> 'title', x ->> 'tagline', x ->> 'art',
            (x ->> 'startsOn')::date::timestamp at time zone 'UTC',          -- null when TBD
            ((x ->> 'startsOn')::date + 7)::timestamp at time zone 'UTC',
            (x ->> 'xpReward')::int, x -> 'trophy' ->> 'id', x -> 'trophy' ->> 'name', x ->> 'titleReward',
            public.effective_status(x ->> 'status', p_publish_drafts))
    on conflict (id) do update set title = excluded.title, tagline = excluded.tagline, art = excluded.art,
      starts_at = excluded.starts_at, ends_at = excluded.ends_at, xp_reward = excluded.xp_reward,
      trophy_id = excluded.trophy_id, trophy_name = excluded.trophy_name, title_reward = excluded.title_reward, status = excluded.status;
    delete from public.quest_requirements where quest_id = x ->> 'id';
    insert into public.quest_requirements (quest_id, skill_id, new_levels, sort_order)
    select x ->> 'id', r.value ->> 'skillId', (r.value ->> 'newLevels')::int, r.ordinality::int
    from jsonb_array_elements(x -> 'requirements') with ordinality r;
  end loop;
  return jsonb_build_object('quests', n);
end $$;

-- Show a title and/or an emblem, each from a quest whose trophy you hold (null shows none).
create or replace function public.set_equipped(p_title_quest text, p_emblem_quest text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_title_quest is not null and not exists (select 1 from public.user_trophies where user_id = v_uid and quest_id = p_title_quest) then
    raise exception 'NOT_EARNED';
  end if;
  if p_emblem_quest is not null and not exists (select 1 from public.user_trophies where user_id = v_uid and quest_id = p_emblem_quest) then
    raise exception 'NOT_EARNED';
  end if;
  update public.profiles set equipped_title_quest = p_title_quest, equipped_emblem_quest = p_emblem_quest where id = v_uid;
  return jsonb_build_object('title_quest_id', p_title_quest, 'emblem_quest_id', p_emblem_quest);
end $$;
revoke execute on function public.set_equipped(text, text) from public, anon;
grant execute on function public.set_equipped(text, text) to authenticated;

-- get_quests also says what the learner shows.
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
                 ) shelf),
    'equipped', (select jsonb_build_object('title_quest_id', equipped_title_quest, 'emblem_quest_id', equipped_emblem_quest)
                 from public.profiles where id = v_uid));
end $$;
