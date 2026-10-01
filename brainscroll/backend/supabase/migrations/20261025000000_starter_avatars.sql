-- Starter avatars (owner, 2026-10-01): no letter avatars. Every account wears a random tree
-- avatar from the start (any shipped tree's, the starter set), changed later from Edit
-- profile. set_avatar no longer takes null. Mirrors core/localSocial ensureIdentity.

-- A random starter: the avatar of a shipped tree (one with published levels). Null only
-- before any content is published.
create or replace function public.random_starter_avatar() returns text
language sql volatile security definer set search_path = public, pg_temp as $$
  select 'avatar.' || split_part(s.id, '.', 3) from public.skills s
  where exists (select 1 from public.levels l where l.skill_id = s.id and l.status = 'published')
    and split_part(s.id, '.', 3) ~ '^[a-z_]+$'
  order by random() limit 1
$$;
revoke execute on function public.random_starter_avatar() from public, anon, authenticated;

-- New accounts get one as their profile is created.
create or replace function public.assign_starter_avatar() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.avatar is null then new.avatar := public.random_starter_avatar(); end if;
  return new;
end $$;
revoke execute on function public.assign_starter_avatar() from public, anon, authenticated;
drop trigger if exists profiles_starter_avatar on public.profiles;
create trigger profiles_starter_avatar before insert on public.profiles
  for each row execute function public.assign_starter_avatar();

-- Accounts made before this (or before content was published) get one the next time
-- anything social runs for them.
create or replace function public.ensure_social_identity(p_uid uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_code text;
begin
  update public.profiles set username = public.generate_username() where id = p_uid and username is null;
  update public.profiles set avatar = public.random_starter_avatar() where id = p_uid and avatar is null;
  if exists (select 1 from public.profiles where id = p_uid and invite_code is null) then
    loop
      v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
      exit when not exists (select 1 from public.profiles where invite_code = v_code);
    end loop;
    update public.profiles set invite_code = v_code where id = p_uid and invite_code is null;
  end if;
end $$;
revoke execute on function public.ensure_social_identity(uuid) from public, anon, authenticated;

-- Everyone who has none yet gets one now.
update public.profiles set avatar = public.random_starter_avatar() where avatar is null;

-- Wear an avatar: any tree's; its gold one at Level 100; a legendary one with its trophy.
-- There's no going back to a letter.
create or replace function public.set_avatar(p_avatar text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_slug text;
  v_skill text;
  v_trophy text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_avatar is null then raise exception 'AVATAR_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_avatar like 'avatar.legendary.%' then
    v_trophy := public.legendary_avatar_trophy(p_avatar);
    if v_trophy is null then raise exception 'AVATAR_NOT_FOUND' using errcode = 'P0002'; end if;
    if not exists (select 1 from jsonb_array_elements(public.milestone_trophies(v_uid)) t where t ->> 'trophy_id' = v_trophy) then
      raise exception 'AVATAR_LOCKED' using errcode = '42501';
    end if;
  else
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
