-- The world leaderboard (owner, 2026-10-09: "a worldwide leaderboard"; "i dont want it to reset
-- ever"; "a clean display and small, and when you click on it, it shows the top 50"). Everyone with
-- XP has a place by total XP, all time: the same total a profile shows. Ties go to whoever got there
-- first. Social shows the top 3 and your place; opened, the top 50 (core WORLD_BOARD.TOP).
-- Everyone is named ("we don't need to do hidden learner"): a row is a username, avatar, place and
-- total XP, private profile or not, as the privacy policy says. Someone blocked either way is left
-- off your board, and their place still counts.

create or replace function public.get_world_board() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_top constant int := 50; -- core WORLD_BOARD.TOP
  v_ranked int;
  v_mine int;
  v_my_xp int;
  v_users uuid[];
  v_places int[];
  v_xps int[];
  u uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  with xp as (
    select e.user_id, sum(e.amount)::int as xp, max(e.created_at) as last_at
    from public.xp_events e
    group by e.user_id
    having sum(e.amount) > 0
  ),
  ranked as (select user_id, xp, row_number() over (order by xp desc, last_at, user_id)::int as place from xp),
  shown as (select * from ranked r where r.place <= v_top and (r.user_id = v_uid or not public.blocked_between(v_uid, r.user_id)))
  select (select count(*) from ranked)::int,
         (select place from ranked where user_id = v_uid),
         array(select user_id from shown order by place),
         array(select place from shown order by place),
         array(select xp from shown order by place)
  into v_ranked, v_mine, v_users, v_places, v_xps;
  v_my_xp := coalesce((select sum(amount) from public.xp_events where user_id = v_uid), 0)::int;

  -- Everyone shown has a username, as joining Social would give them.
  foreach u in array v_users || v_uid loop perform public.ensure_social_identity(u); end loop;

  return jsonb_build_object(
    'ranked', v_ranked,
    'rows', coalesce((
      select jsonb_agg(public.social_card(t.user_id) || jsonb_build_object('place', t.place, 'total_xp', t.xp, 'you', t.user_id = v_uid,
               'friend', exists (select 1 from public.friendships f where f.user_id = v_uid and f.friend_id = t.user_id))
             order by t.place)
      from unnest(v_users, v_places, v_xps) as t(user_id, place, xp)), '[]'::jsonb),
    -- Your own row, wherever you are; no place before your first XP.
    'you', public.social_card(v_uid) || jsonb_build_object('place', v_mine, 'total_xp', greatest(v_my_xp, 0), 'you', true, 'friend', false)
  );
end $$;
revoke execute on function public.get_world_board() from public, anon;
grant execute on function public.get_world_board() to authenticated;
