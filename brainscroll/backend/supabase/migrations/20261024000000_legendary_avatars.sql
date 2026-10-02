-- Legendary avatars (owner art, 2026-10-01; docs/images-avatars-legendary.md): one per top gold
-- trophy, worn only with that trophy earned. Master of All is a golden Dr. Scroll. Mirrors core
-- LEGENDARY_AVATARS.

alter table public.profiles drop constraint profiles_avatar_check;
alter table public.profiles add constraint profiles_avatar_check
  check (avatar is null or avatar ~ '^avatar\.([a-z_]+(\.gold)?|legendary\.[a-z_]+)$');

create or replace function public.legendary_avatar_trophy(p_avatar text) returns text
language sql immutable as $$
  select (jsonb_build_object(
    'avatar.legendary.master_of_all', 'trophy.master_of_all',
    'avatar.legendary.jack_of_all_trades', 'trophy.jack_of_all_trades',
    'avatar.legendary.master_history', 'trophy.subject_history',
    'avatar.legendary.master_science', 'trophy.subject_science',
    'avatar.legendary.master_geography', 'trophy.subject_geography',
    'avatar.legendary.master_arts', 'trophy.subject_arts',
    'avatar.legendary.master_world_systems', 'trophy.subject_world_systems',
    'avatar.legendary.master_mind', 'trophy.subject_mind',
    'avatar.legendary.thousand_levels', 'trophy.thousand',
    'avatar.legendary.fifty_chapters', 'trophy.fifty_chapters',
    'avatar.legendary.perfect_thousand', 'trophy.perfect_1000',
    'avatar.legendary.steel_trap', 'trophy.steel_trap',
    'avatar.legendary.quest_legend', 'trophy.quests_52',
    'avatar.legendary.streak_thousand', 'trophy.streak_1000'
  ) ->> p_avatar)
$$;

-- Wear an avatar (null goes back to the initial): any tree's; its gold one at Level 100; a
-- legendary one with its trophy.
create or replace function public.set_avatar(p_avatar text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_slug text;
  v_skill text;
  v_trophy text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_avatar like 'avatar.legendary.%' then
    v_trophy := public.legendary_avatar_trophy(p_avatar);
    if v_trophy is null then raise exception 'AVATAR_NOT_FOUND' using errcode = 'P0002'; end if;
    if not exists (select 1 from jsonb_array_elements(public.milestone_trophies(v_uid)) t where t ->> 'trophy_id' = v_trophy) then
      raise exception 'AVATAR_LOCKED' using errcode = '42501';
    end if;
  elsif p_avatar is not null then
    v_slug := substring(p_avatar from '^avatar\.([a-z_]+)(\.gold)?$');
    -- A shipped skill: one with published levels (skill rows themselves can stay draft).
    select s.id into v_skill from public.skills s
    where split_part(s.id, '.', 3) = v_slug and exists (select 1 from public.levels l where l.skill_id = s.id and l.status = 'published');
    if v_skill is null then raise exception 'AVATAR_NOT_FOUND' using errcode = 'P0002'; end if;
    if p_avatar like '%.gold' and coalesce((select highest_cleared from public.user_skill_progress where user_id = v_uid and skill_id = v_skill), 0) < 100 then
      raise exception 'AVATAR_LOCKED' using errcode = '42501';
    end if;
  end if;
  update public.profiles set avatar = p_avatar where id = v_uid;
  return jsonb_build_object('avatar', p_avatar);
end $$;
revoke execute on function public.set_avatar(text) from public, anon;
grant execute on function public.set_avatar(text) to authenticated;
