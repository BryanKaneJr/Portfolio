-- Profile avatars (owner, 2026-10-01; art in app/assets/images/avatars, briefs in docs/images-avatars*.md).
-- Every tree's avatar (avatar.<skill slug>) is unlocked from the start; its gold one
-- (avatar.<skill slug>.gold) unlocks at Level 100 of that tree. Mirrors core avatarUnlocked.

alter table public.profiles
  add column avatar text check (avatar is null or avatar ~ '^avatar\.[a-z_]+(\.gold)?$');

-- Learner cards carry the avatar, so leagues, the feed, friends and profiles all show it.
create or replace function public.social_card(p_uid uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', p.id, 'username', p.username, 'avatar', p.avatar, 'knowledge_level', public.user_knowledge_level(p.id),
    'weekly_xp', public.weekly_xp(p.id, public.league_week_start(now())))
  from public.profiles p where p.id = p_uid
$$;
revoke execute on function public.social_card(uuid) from public, anon, authenticated;

-- Wear an avatar (null goes back to the initial). Gold ones need the tree mastered.
create or replace function public.set_avatar(p_avatar text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_slug text;
  v_skill text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_avatar is not null then
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

-- get_social's "me" gains the avatar too.
create or replace function public.get_social() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  perform public.ensure_social_identity(v_uid);
  return jsonb_build_object(
    'me', (select jsonb_build_object('id', id, 'username', username, 'invite_code', invite_code, 'avatar', avatar) from public.profiles where id = v_uid),
    'friends', (select coalesce(jsonb_agg(public.social_card(f.friend_id) order by public.weekly_xp(f.friend_id, public.league_week_start(now())) desc), '[]')
                from public.friendships f where f.user_id = v_uid),
    'incoming', (select coalesce(jsonb_agg(public.social_card(r.user_id) order by r.created_at), '[]')
                 from public.friend_requests r where r.to_id = v_uid and not public.blocked_between(v_uid, r.user_id)),
    'outgoing', (select coalesce(jsonb_agg(public.social_card(r.to_id) order by r.created_at), '[]')
                 from public.friend_requests r where r.user_id = v_uid)
  );
end $$;
