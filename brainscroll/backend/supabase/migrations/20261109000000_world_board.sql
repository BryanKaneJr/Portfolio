-- The world leaderboard (owner, 2026-10-09: "a worldwide leaderboard ... like 10 people ... the top 3,
-- and then sprinkle in some friends whatever number they are on the world leaderboard, and then
-- wherever you are"). Social's friend list becomes ten rows of this week's world ranking. Everyone
-- with XP this week has a place, counted as weekly_xp counts it (league prizes aside); ties go to
-- whoever got there first. The rows are the top 3 and you, the friends nearest your place, then the
-- places nearest yours (world_board_places, mirroring core worldBoardPlaces). A learner blocked
-- either way, and a private profile outside your friends and league, keep their place and XP with no
-- name, like the league's hidden rows.

-- This week's XP for everyone is one range scan.
create index if not exists xp_events_created_at on public.xp_events (created_at);

-- Which places the board shows, in order. Mirrors core worldBoardPlaces (WORLD_BOARD: 10 rows, top 3).
create or replace function public.world_board_places(p_total int, p_mine int, p_friends int[]) returns int[]
language plpgsql immutable set search_path = public, pg_temp as $$
declare
  v_rows constant int := 10;
  v_top constant int := 3;
  v_shown int[] := '{}';
  v_candidates int[];
  p int;
  d int := 1;
begin
  v_candidates := array(select g from generate_series(1, least(v_top, p_total)) g) || p_mine
    || array(select f from unnest(coalesce(p_friends, '{}')) f order by abs(f - p_mine), f);
  foreach p in array v_candidates loop
    if cardinality(v_shown) < v_rows and p between 1 and p_total and not p = any(v_shown) then v_shown := v_shown || p; end if;
  end loop;
  while d < p_total and cardinality(v_shown) < v_rows loop
    foreach p in array array[p_mine - d, p_mine + d] loop
      if cardinality(v_shown) < v_rows and p between 1 and p_total and not p = any(v_shown) then v_shown := v_shown || p; end if;
    end loop;
    d := d + 1;
  end loop;
  return array(select x from unnest(v_shown) x order by x);
end $$;
revoke execute on function public.world_board_places(int, int, int[]) from public, anon, authenticated;

create or replace function public.get_world_board() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_week date := public.league_week_start(now());
  v_ranked int;
  v_users uuid[];
  v_places int[];
  v_xps int[];
  u uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  with xp as (
    select e.user_id, sum(e.amount)::int as xp, max(e.created_at) as last_at
    from public.xp_events e
    where e.created_at >= public.week_start_at(v_week) and e.created_at < public.week_start_at(v_week + 7) and e.type <> 'LEAGUE_FINISH'
    group by e.user_id
    having sum(e.amount) > 0
  ),
  ranked as (select user_id, xp, row_number() over (order by xp desc, last_at, user_id)::int as place from xp),
  meta as (
    select (select count(*) from ranked)::int as n,
           (select place from ranked where user_id = v_uid) as mine,
           array(select r.place from ranked r join public.friendships f on f.user_id = v_uid and f.friend_id = r.user_id) as friends
  ),
  -- With no XP yet you come one after the last place.
  picked as (
    select unnest(public.world_board_places(m.n + (m.mine is null)::int, coalesce(m.mine, m.n + 1), m.friends)) as place from meta m
  )
  select (select n from meta), array_agg(coalesce(r.user_id, v_uid) order by p.place), array_agg(p.place order by p.place), array_agg(coalesce(r.xp, 0) order by p.place)
  into v_ranked, v_users, v_places, v_xps
  from picked p left join ranked r on r.place = p.place;

  -- Everyone shown has a username, as joining Social would give them.
  foreach u in array v_users loop perform public.ensure_social_identity(u); end loop;

  return jsonb_build_object(
    'week_start', v_week,
    'ranked', v_ranked,
    'rows', coalesce((
      select jsonb_agg(
               case when t.user_id <> v_uid and (public.blocked_between(v_uid, t.user_id)
                         or (pr.private_profile and not exists (select 1 from public.social_circle(v_uid) c where c.user_id = t.user_id)))
                 then jsonb_build_object('id', null, 'username', null, 'avatar', null, 'knowledge_level', null,
                                         'place', t.place, 'weekly_xp', t.xp, 'you', false, 'friend', false, 'hidden', true)
                 else public.social_card(t.user_id) || jsonb_build_object('place', t.place, 'weekly_xp', t.xp, 'you', t.user_id = v_uid,
                        'friend', exists (select 1 from public.friendships f where f.user_id = v_uid and f.friend_id = t.user_id), 'hidden', false)
               end
               order by t.place)
      from unnest(v_users, v_places, v_xps) as t(user_id, place, xp)
      join public.profiles pr on pr.id = t.user_id), '[]'::jsonb)
  );
end $$;
revoke execute on function public.get_world_board() from public, anon;
grant execute on function public.get_world_board() to authenticated;
