-- League tiers (owner, 2026-10-08: "apply levels to leagues that they level up
-- or level down in each week"; seven gems "and then crown as the top", core
-- LEAGUE_TIERS). Eight tiers, the Quartz League up to the Crown League; everyone
-- starts in Quartz. Leagues are made within a tier instead of by brain level. When a
-- week ends, the top 5 move up a tier and the bottom 3 move down; a league under
-- 10 moves only its top 3 up and nobody down (core leagueMove). Moving up takes
-- XP that week and someone behind you, as a prize does. A learner's tier shows
-- on their card (profiles, league rows, friends), moving up is a feed moment,
-- and Monday's result notification says where they moved.

-- ── Settings (core LEAGUE) ──
alter table public.app_settings
  add column league_promote int not null default 5 check (league_promote between 0 and 20),
  add column league_demote int not null default 3 check (league_demote between 0 and 20),
  add column league_small_size int not null default 10 check (league_small_size between 1 and 100),
  add column league_promote_small int not null default 3 check (league_promote_small between 0 and 20);

-- ── Where everyone stands ──
alter table public.profiles add column league_tier smallint not null default 1 check (league_tier between 1 and 8);
-- The tier a league was made for (its first learner's): leagues are matched on it.
alter table public.leagues add column tier smallint not null default 1 check (tier between 1 and 8);
create index leagues_week_tier on public.leagues (week_start, tier) where finalized_at is null;
-- Each learner's own tier that week (a safety-net joiner may come from another),
-- and where the week's finish moved them (-1, 0 or 1; null until it ends).
alter table public.league_members
  add column tier smallint not null default 1 check (tier between 1 and 8),
  add column moved smallint check (moved between -1 and 1);

-- Where finishing at p_place in a league of p_size with p_xp that week moves a learner. Mirrors core leagueMove.
create or replace function public.league_move(p_place int, p_size int, p_xp int) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when p_size < s.league_small_size then case when p_place <= s.league_promote_small and p_size > p_place and p_xp > 0 then 1 else 0 end
    when p_place <= s.league_promote then case when p_xp > 0 then 1 else 0 end
    when p_place > p_size - s.league_demote then -1
    else 0
  end
  from public.app_settings s
$$;
revoke execute on function public.league_move(int, int, int) from public, anon, authenticated;

-- ── The week ends: prizes as before, then everyone moves ──
create or replace function public.finalize_leagues_of(p_uid uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s public.app_settings;
  lg record;
  r record;
  prizes int[];
  n int;
  v_prize int;
  v_tier int;
begin
  select * into s from public.app_settings;
  prizes := array[s.league_prize_1, s.league_prize_2, s.league_prize_3];
  -- Oldest first, so a learner's tier moves in the order their weeks were played.
  for lg in
    select l.* from public.leagues l join public.league_members m on m.league_id = l.id
    where m.user_id = p_uid and l.finalized_at is null and l.week_start + 7 <= public.league_week_start(now())
    order by l.week_start
    for update of l
  loop
    select count(*) into n from public.league_members where league_id = lg.id;
    for r in
      select m.user_id, m.tier, public.weekly_xp(m.user_id, lg.week_start) as xp,
             row_number() over (order by public.weekly_xp(m.user_id, lg.week_start) desc, m.joined_at, m.user_id) as place
      from public.league_members m where m.league_id = lg.id
    loop
      v_prize := 0;
      if r.place <= 3 and r.xp > 0 and n > r.place then
        insert into public.xp_events (user_id, type, amount, reason, idempotency_key)
        values (r.user_id, 'LEAGUE_FINISH', prizes[r.place], 'league week ' || lg.week_start || ': place ' || r.place, 'league_finish:' || lg.id)
        on conflict (user_id, idempotency_key) do nothing;
        v_prize := prizes[r.place];
      end if;
      -- Up or down one tier, never past the first or the last (core movedTier).
      v_tier := least(8, greatest(1, r.tier + public.league_move(r.place::int, n, r.xp)));
      update public.league_members set moved = v_tier - r.tier where league_id = lg.id and user_id = r.user_id;
      update public.profiles set league_tier = v_tier where id = r.user_id;
      if r.xp > 0 then
        perform public.enqueue_push(r.user_id, 'league_result',
          jsonb_build_object('league_id', lg.id, 'place', r.place, 'of', n, 'prize', v_prize, 'moved', v_tier - r.tier, 'tier', v_tier));
      end if;
    end loop;
    update public.leagues set finalized_at = now() where id = lg.id;
  end loop;
end $$;
revoke execute on function public.finalize_leagues_of(uuid) from public, anon, authenticated;

-- ── Joining: the fullest league in your tier, else a small one nearby, else a new one ──
create or replace function public.join_league(p_uid uuid) returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s public.app_settings;
  v_week date := public.league_week_start(now());
  v_kl int := public.user_knowledge_level(p_uid);
  v_tier int := (select league_tier from public.profiles where id = p_uid);
  v_id bigint;
begin
  select league_id into v_id from public.league_members where user_id = p_uid and week_start = v_week;
  if found then return v_id; end if;
  select * into s from public.app_settings;
  -- One matcher at a time, so two learners can't overfill a league.
  perform pg_advisory_xact_lock(hashtext('league_join'), v_week - date '2000-01-01');
  select l.id into v_id
  from public.leagues l join public.league_members m on m.league_id = l.id
  where l.week_start = v_week and l.finalized_at is null and l.tier = v_tier
  group by l.id having count(*) < s.league_size
  order by count(*) desc, l.id
  limit 1;
  if v_id is not null then
    insert into public.league_members (league_id, user_id, week_start, knowledge_level, tier) values (v_id, p_uid, v_week, v_kl, v_tier);
    return v_id;
  end if;
  -- The safety net: nobody in this tier yet, so join a league that's still small, the nearest tier first,
  -- rather than start alone. The joiner keeps their own tier: their finish moves them from it.
  select l.id into v_id
  from public.leagues l join public.league_members m on m.league_id = l.id
  where l.week_start = v_week and l.finalized_at is null
  group by l.id having count(*) < s.league_min_size
  order by abs(l.tier - v_tier), count(*) desc, l.id limit 1;
  if v_id is not null then
    insert into public.league_members (league_id, user_id, week_start, knowledge_level, via_safety_net, tier) values (v_id, p_uid, v_week, v_kl, true, v_tier);
    return v_id;
  end if;
  insert into public.leagues (week_start, tier) values (v_week, v_tier) returning id into v_id;
  insert into public.league_members (league_id, user_id, week_start, knowledge_level, tier) values (v_id, p_uid, v_week, v_kl, v_tier);
  return v_id;
end $$;
revoke execute on function public.join_league(uuid) from public, anon, authenticated;

-- ── The league view: your tier, and where last week moved you ──
create or replace function public.get_league() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_id bigint;
  v_week date := public.league_week_start(now());
  v_last jsonb;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  perform public.ensure_social_identity(v_uid);
  perform public.finalize_leagues_of(v_uid);
  v_id := public.join_league(v_uid);
  select jsonb_build_object('week_start', l.week_start, 'place', e.reason, 'xp', e.amount, 'moved', m.moved, 'tier', m.tier + coalesce(m.moved, 0)) into v_last
  from public.league_members m join public.leagues l on l.id = m.league_id
  left join public.xp_events e on e.user_id = v_uid and e.idempotency_key = 'league_finish:' || l.id
  where m.user_id = v_uid and l.week_start < v_week
  order by l.week_start desc limit 1;
  return jsonb_build_object(
    'league_id', v_id,
    'tier', (select tier from public.league_members where league_id = v_id and user_id = v_uid),
    'week_start', v_week,
    'ends_at', public.week_start_at(v_week + 7),
    'members', (
      select coalesce(jsonb_agg(
               case when m.user_id <> v_uid and public.blocked_between(v_uid, m.user_id)
                 -- Blocked either way: their place and XP still count, but nothing says who they are.
                 then jsonb_build_object('id', null, 'username', null, 'avatar', null, 'knowledge_level', null,
                                         'weekly_xp', public.weekly_xp(m.user_id, v_week), 'you', false, 'blocked', true)
                 else public.social_card(m.user_id) || jsonb_build_object('you', m.user_id = v_uid, 'blocked', false)
               end
               order by public.weekly_xp(m.user_id, v_week) desc, m.joined_at, m.user_id), '[]')
      from public.league_members m where m.league_id = v_id),
    'last_week', v_last
  );
end $$;

-- ── Cards carry the tier (league rows, friends, profiles, the feed) ──
create or replace function public.social_card(p_uid uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', p.id, 'username', p.username, 'avatar', p.avatar, 'knowledge_level', public.user_knowledge_level(p.id),
    'weekly_xp', public.weekly_xp(p.id, public.league_week_start(now())),
    'ring', p.look_ring, 'name_style', p.look_name_style, 'title', public.shown_title(p.id),
    'league_tier', p.league_tier)
  from public.profiles p where p.id = p_uid
$$;

-- Your own tier, for Profile.
create or replace function public.get_social() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  perform public.ensure_social_identity(v_uid);
  return jsonb_build_object(
    'me', (select jsonb_build_object('id', id, 'username', username, 'invite_code', invite_code, 'avatar', avatar,
                                     'social_notifications', social_notifications, 'private_profile', private_profile,
                                     'league_tier', league_tier)
           from public.profiles where id = v_uid),
    'friends', (select coalesce(jsonb_agg(public.social_card(f.friend_id) order by public.weekly_xp(f.friend_id, public.league_week_start(now())) desc), '[]')
                from public.friendships f where f.user_id = v_uid),
    'incoming', (select coalesce(jsonb_agg(public.social_card(r.user_id) order by r.created_at), '[]')
                 from public.friend_requests r where r.to_id = v_uid and not public.blocked_between(v_uid, r.user_id)),
    'outgoing', (select coalesce(jsonb_agg(public.social_card(r.to_id) order by r.created_at), '[]')
                 from public.friend_requests r where r.user_id = v_uid)
  );
end $$;

-- ── Moving up is a moment in the feed (moving down never is) ──
create or replace function public.feed_moments(p_uid uuid, p_since timestamptz)
returns table (kind text, item_key text, at timestamptz, data jsonb)
language sql stable security definer set search_path = public, pg_temp as $$
  -- Trophies (milestones, mastery, subjects) and quest trophies.
  select 'trophy'::text, 'trophy:' || (x ->> 'trophy_id'), (x ->> 'earned_at')::timestamptz, jsonb_build_object('trophy_id', x ->> 'trophy_id')
  from jsonb_array_elements(public.milestone_trophies(p_uid)) x
  where (x ->> 'earned_at')::timestamptz >= p_since
  union all
  select 'trophy', 'trophy:' || t.trophy_id, t.earned_at, jsonb_build_object('trophy_id', t.trophy_id, 'name', t.name)
  from public.user_trophies t where t.user_id = p_uid and t.earned_at >= p_since
  -- Chapters finished: every 10th level.
  union all
  select 'chapter', 'chapter:' || lp.level_id, lp.completed_at, jsonb_build_object('skill_id', l.skill_id, 'chapter', l.number / 10)
  from public.user_level_progress lp join public.levels l on l.id = lp.level_id and l.number % 10 = 0
  where lp.user_id = p_uid and lp.completed_at >= p_since
  -- Streak milestones: the day a run reached 3, 7, 14, 30 ... days.
  union all
  select 'streak', 'streak:' || r.k || ':' || r.d, r.at, jsonb_build_object('days', r.k)
  from (
    select d, at, row_number() over (partition by grp order by d)::int as k
    from (
      select ld.day as d, ld.first_at as at, ld.day - (row_number() over (order by ld.day))::int as grp
      from public.user_learning_days ld where ld.user_id = p_uid
    ) runs
  ) r
  where r.at >= p_since and r.k = any (public.streak_feed_milestones())
  -- League podiums.
  union all
  select 'league', 'league:' || e.idempotency_key, e.created_at, jsonb_build_object('reason', e.reason, 'xp', e.amount)
  from public.xp_events e where e.user_id = p_uid and e.type = 'LEAGUE_FINISH' and e.created_at >= p_since
  -- Moving up a tier.
  union all
  select 'tier', 'tier:' || m.league_id, l.finalized_at, jsonb_build_object('tier', m.tier + m.moved)
  from public.league_members m join public.leagues l on l.id = m.league_id
  where m.user_id = p_uid and m.moved = 1 and l.finalized_at >= p_since
$$;
revoke execute on function public.feed_moments(uuid, timestamptz) from public, anon, authenticated;

-- ── "Passed you" notes name your league by your tier ──
create or replace function public.push_on_xp() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_week date := public.league_week_start(new.created_at);
  v_league bigint;
  v_new int;
  v_old int;
  v_name text;
  m record;
begin
  if new.type = 'LEAGUE_FINISH' or new.amount <= 0 then return new; end if;
  select l.id into v_league from public.league_members lm join public.leagues l on l.id = lm.league_id
  where lm.user_id = new.user_id and l.week_start = v_week;
  if v_league is null then return new; end if;
  v_new := public.weekly_xp(new.user_id, v_week);
  v_old := v_new - new.amount;
  for m in
    select lm.user_id, lm.tier, public.weekly_xp(lm.user_id, v_week) as xp from public.league_members lm
    where lm.league_id = v_league and lm.user_id <> new.user_id
  loop
    if m.xp > 0 and m.xp >= v_old and m.xp < v_new and not public.blocked_between(m.user_id, new.user_id)
       and not exists (select 1 from public.notification_outbox o where o.user_id = m.user_id and o.kind = 'passed' and o.created_at > now() - interval '20 hours') then
      v_name := coalesce(v_name, (select username from public.profiles where id = new.user_id));
      perform public.enqueue_push(m.user_id, 'passed',
        jsonb_build_object('user_id', new.user_id, 'username', v_name, 'gap', v_new - m.xp, 'league_id', v_league, 'tier', m.tier));
    end if;
  end loop;
  return new;
end $$;
revoke execute on function public.push_on_xp() from public, anon, authenticated;
