-- Social (owner, 2026-10-01): friends, weekly leagues and a feed, before launch.
-- "Friends and leagues or some social aspect are a must before launch if we
-- want the app to spread." Mirrors packages/core/src/social.ts.
--
-- - Usernames: unique, lowercase a-z 0-9 _, 3 to 20 characters. Everyone gets
--   a friendly generated one (curious_otter_4821) the first time they use
--   Social, and can change it.
-- - Friends: by exact username or an invite link (a code per learner). A
--   request waits for the other side; an invite link is consent from the
--   inviter, so opening one makes you friends at once. Block and report ship
--   with it. No messages, no comments: the only reactions are Dr. Scroll poses.
-- - Leagues: weekly, Monday 00:00 UTC (as quests), up to 20 learners matched
--   by brain (knowledge) level: within 20% of each other, and anyone under
--   Level 100 is fair game. While few people are around, a learner with no
--   good match joins any league still under 5 (the safety net), so nobody
--   competes alone; a safety-net joiner doesn't set that league's level band. Weekly XP is read from the ledger (every event this week
--   except league prizes). When a week ends, the top 3 earn 1,000 / 500 / 250
--   XP (an owner exception to "nothing dwarfs a level"), paid as a
--   LEAGUE_FINISH event the first time anyone in the league opens Social
--   afterwards. Place k pays only in a league of more than k learners, and
--   only with XP that week.
-- - Feed: derived from what's already recorded, for you, your friends and
--   your current league mates, over the last 14 days: trophies, chapters
--   finished, streak milestones and league podiums. Nothing is stored twice.

alter type public.xp_event_type add value if not exists 'LEAGUE_FINISH';

alter table public.app_settings
  add column league_size int not null default 20,
  add column league_min_size int not null default 5,
  add column league_prize_1 int not null default 1000,
  add column league_prize_2 int not null default 500,
  add column league_prize_3 int not null default 250;
comment on column public.app_settings.league_size is 'Most learners in a league. Mirrors LEAGUE.SIZE (core).';
comment on column public.app_settings.league_min_size is 'A learner with no level match joins a league still under this size before a new one starts. Mirrors LEAGUE.SAFETY_NET_SIZE (core).';
comment on column public.app_settings.league_prize_1 is 'XP for 1st in a league week (owner, 2026-10-01). Mirrors LEAGUE.PRIZES (core).';

alter table public.profiles
  add column username text check (username is null or username ~ '^[a-z0-9_]{3,20}$'),
  add column invite_code text check (invite_code is null or invite_code ~ '^[A-Z0-9]{8}$');
create unique index profiles_username_key on public.profiles (username);
create unique index profiles_invite_code_key on public.profiles (invite_code);

-- Two rows per friendship (one each way), so "my friends" is one lookup.
create table public.friendships (
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create index friendships_friend on public.friendships (friend_id);

create table public.friend_requests (
  user_id uuid not null references public.profiles (id) on delete cascade, -- from
  to_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, to_id),
  check (user_id <> to_id)
);
create index friend_requests_to on public.friend_requests (to_id);

create table public.user_blocks (
  user_id uuid not null references public.profiles (id) on delete cascade, -- blocker
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id)
);
create index user_blocks_blocked on public.user_blocks (blocked_id);

create table public.user_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade, -- reporter
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('username', 'cheating', 'other')),
  note text check (note is null or length(note) <= 500),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now()
);

create table public.leagues (
  id bigint generated always as identity primary key,
  week_start date not null,
  created_at timestamptz not null default now(),
  finalized_at timestamptz
);
create index leagues_week on public.leagues (week_start) where finalized_at is null;

create table public.league_members (
  league_id bigint not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  knowledge_level int not null,
  -- Joined through the safety net, outside the league's level band: not counted when matching others.
  via_safety_net boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id),
  unique (user_id, week_start)
);

create table public.feed_reactions (
  user_id uuid not null references public.profiles (id) on delete cascade, -- who reacted
  owner_id uuid not null references public.profiles (id) on delete cascade, -- whose moment
  item_key text not null check (length(item_key) <= 200),
  reaction text not null check (reaction in ('clapping', 'celebrate', 'thumbs-up', 'surprised', 'mastery')),
  created_at timestamptz not null default now(),
  primary key (owner_id, item_key, user_id)
);

alter table public.friendships enable row level security;
alter table public.friend_requests enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.feed_reactions enable row level security;
-- No policies: everything goes through the functions below.

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.league_week_start(p_at timestamptz) returns date
language sql immutable as $$ select date_trunc('week', p_at at time zone 'UTC')::date $$;

create or replace function public.week_start_at(p_week date) returns timestamptz
language sql immutable as $$ select p_week::timestamp at time zone 'UTC' $$;

create or replace function public.user_knowledge_level(p_uid uuid) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select public.knowledge_level(coalesce((select sum(highest_cleared) from public.user_skill_progress where user_id = p_uid), 0)::int)
$$;

-- XP earned in a league week: every ledger event in it except league prizes.
create or replace function public.weekly_xp(p_uid uuid, p_week date) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sum(amount), 0)::int from public.xp_events
  where user_id = p_uid and type <> 'LEAGUE_FINISH'
    and created_at >= public.week_start_at(p_week) and created_at < public.week_start_at(p_week + 7)
$$;

-- Either side blocked the other.
create or replace function public.blocked_between(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.user_blocks where (user_id = p_a and blocked_id = p_b) or (user_id = p_b and blocked_id = p_a))
$$;

-- A friendly username nobody has: curious_otter_4821.
create or replace function public.generate_username() returns text
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  adj text[] := array['curious', 'bright', 'clever', 'swift', 'bold', 'calm', 'keen', 'wise', 'sunny', 'lucky', 'brave', 'witty'];
  noun text[] := array['owl', 'fox', 'otter', 'panda', 'falcon', 'koala', 'lynx', 'heron', 'badger', 'whale', 'comet', 'atlas'];
  v text;
begin
  loop
    v := adj[1 + floor(random() * array_length(adj, 1))::int] || '_' || noun[1 + floor(random() * array_length(noun, 1))::int] || '_' || lpad(floor(random() * 10000)::int::text, 4, '0');
    exit when not exists (select 1 from public.profiles where username = v);
  end loop;
  return v;
end $$;

-- Gives the learner a username and an invite code if they have none yet.
create or replace function public.ensure_social_identity(p_uid uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_code text;
begin
  update public.profiles set username = public.generate_username() where id = p_uid and username is null;
  if exists (select 1 from public.profiles where id = p_uid and invite_code is null) then
    loop
      v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
      exit when not exists (select 1 from public.profiles where invite_code = v_code);
    end loop;
    update public.profiles set invite_code = v_code where id = p_uid and invite_code is null;
  end if;
end $$;

-- Who a learner sees: friends and current league mates, minus anyone blocked either way.
create or replace function public.social_circle(p_uid uuid) returns table (user_id uuid, is_friend boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  with c as (
    select friend_id as uid, true as f from public.friendships where user_id = p_uid
    union
    select m2.user_id, false from public.league_members m1
    join public.league_members m2 on m2.league_id = m1.league_id and m2.user_id <> p_uid
    where m1.user_id = p_uid and m1.week_start = public.league_week_start(now())
  )
  select uid, bool_or(f) from c where not public.blocked_between(p_uid, uid) group by uid
$$;

-- The public face of a learner: what friends and league mates see in lists.
create or replace function public.social_card(p_uid uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', p.id, 'username', p.username, 'knowledge_level', public.user_knowledge_level(p.id),
    'weekly_xp', public.weekly_xp(p.id, public.league_week_start(now())))
  from public.profiles p where p.id = p_uid
$$;

revoke execute on function public.user_knowledge_level(uuid), public.weekly_xp(uuid, date), public.blocked_between(uuid, uuid),
  public.generate_username(), public.ensure_social_identity(uuid), public.social_circle(uuid), public.social_card(uuid)
  from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Leagues
-- ─────────────────────────────────────────────────────────────────────────────

-- Pays the top 3 of every finished league the learner was in. Idempotent: one prize per league per place.
create or replace function public.finalize_leagues_of(p_uid uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s public.app_settings;
  lg record;
  r record;
  prizes int[];
  n int;
begin
  select * into s from public.app_settings;
  prizes := array[s.league_prize_1, s.league_prize_2, s.league_prize_3];
  for lg in
    select l.* from public.leagues l join public.league_members m on m.league_id = l.id
    where m.user_id = p_uid and l.finalized_at is null and l.week_start + 7 <= public.league_week_start(now())
    for update of l
  loop
    select count(*) into n from public.league_members where league_id = lg.id;
    for r in
      select m.user_id, public.weekly_xp(m.user_id, lg.week_start) as xp,
             row_number() over (order by public.weekly_xp(m.user_id, lg.week_start) desc, m.joined_at, m.user_id) as place
      from public.league_members m where m.league_id = lg.id
    loop
      if r.place <= 3 and r.xp > 0 and n > r.place then
        insert into public.xp_events (user_id, type, amount, reason, idempotency_key)
        values (r.user_id, 'LEAGUE_FINISH', prizes[r.place], 'league week ' || lg.week_start || ': place ' || r.place, 'league_finish:' || lg.id)
        on conflict (user_id, idempotency_key) do nothing;
      end if;
    end loop;
    update public.leagues set finalized_at = now() where id = lg.id;
  end loop;
end $$;
revoke execute on function public.finalize_leagues_of(uuid) from public, anon, authenticated;

-- Puts the learner in this week's league if they aren't in one, and returns its id.
create or replace function public.join_league(p_uid uuid) returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s public.app_settings;
  v_week date := public.league_week_start(now());
  v_kl int := public.user_knowledge_level(p_uid);
  v_id bigint;
begin
  select league_id into v_id from public.league_members where user_id = p_uid and week_start = v_week;
  if found then return v_id; end if;
  select * into s from public.app_settings;
  -- One matcher at a time, so two learners can't overfill a league.
  perform pg_advisory_xact_lock(hashtext('league_join'), v_week - date '2000-01-01');
  -- Fullest league whose levels, with this learner's, stay within 20% (or all under Level 100).
  -- Safety-net joiners don't set a league's band, so one advanced learner can't close a beginners' league.
  select l.id into v_id
  from public.leagues l join public.league_members m on m.league_id = l.id
  where l.week_start = v_week and l.finalized_at is null
  group by l.id
  having count(*) < s.league_size
     and (greatest(max(m.knowledge_level) filter (where not m.via_safety_net), v_kl) < 100
          or greatest(max(m.knowledge_level) filter (where not m.via_safety_net), v_kl)
             <= 1.2 * least(min(m.knowledge_level) filter (where not m.via_safety_net), v_kl))
  order by count(*) desc, l.id
  limit 1;
  if v_id is not null then
    insert into public.league_members (league_id, user_id, week_start, knowledge_level) values (v_id, p_uid, v_week, v_kl);
    return v_id;
  end if;
  -- The safety net: no match, so join a league that's still small rather than start alone.
  select l.id into v_id
  from public.leagues l join public.league_members m on m.league_id = l.id
  where l.week_start = v_week and l.finalized_at is null
  group by l.id having count(*) < s.league_min_size
  order by count(*) desc, l.id limit 1;
  if v_id is not null then
    insert into public.league_members (league_id, user_id, week_start, knowledge_level, via_safety_net) values (v_id, p_uid, v_week, v_kl, true);
    return v_id;
  end if;
  insert into public.leagues (week_start) values (v_week) returning id into v_id;
  insert into public.league_members (league_id, user_id, week_start, knowledge_level) values (v_id, p_uid, v_week, v_kl);
  return v_id;
end $$;
revoke execute on function public.join_league(uuid) from public, anon, authenticated;

-- The learner's league this week: standings, and how last week ended for them.
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
  select jsonb_build_object('week_start', l.week_start, 'place', e.reason, 'xp', e.amount) into v_last
  from public.league_members m join public.leagues l on l.id = m.league_id
  left join public.xp_events e on e.user_id = v_uid and e.idempotency_key = 'league_finish:' || l.id
  where m.user_id = v_uid and l.week_start < v_week
  order by l.week_start desc limit 1;
  return jsonb_build_object(
    'league_id', v_id,
    'week_start', v_week,
    'ends_at', public.week_start_at(v_week + 7),
    'members', (
      select coalesce(jsonb_agg(public.social_card(m.user_id) || jsonb_build_object('you', m.user_id = v_uid, 'blocked', public.blocked_between(v_uid, m.user_id))
                                order by public.weekly_xp(m.user_id, v_week) desc, m.joined_at, m.user_id), '[]')
      from public.league_members m where m.league_id = v_id),
    'last_week', v_last
  );
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Friends
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.get_social() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  perform public.ensure_social_identity(v_uid);
  return jsonb_build_object(
    'me', (select jsonb_build_object('id', id, 'username', username, 'invite_code', invite_code) from public.profiles where id = v_uid),
    'friends', (select coalesce(jsonb_agg(public.social_card(f.friend_id) order by public.weekly_xp(f.friend_id, public.league_week_start(now())) desc), '[]')
                from public.friendships f where f.user_id = v_uid),
    'incoming', (select coalesce(jsonb_agg(public.social_card(r.user_id) order by r.created_at), '[]')
                 from public.friend_requests r where r.to_id = v_uid and not public.blocked_between(v_uid, r.user_id)),
    'outgoing', (select coalesce(jsonb_agg(public.social_card(r.to_id) order by r.created_at), '[]')
                 from public.friend_requests r where r.user_id = v_uid)
  );
end $$;

create or replace function public.set_username(p_username text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v text := lower(trim(p_username));
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if v !~ '^[a-z0-9_]{3,20}$' then raise exception 'USERNAME_INVALID' using errcode = '22023'; end if;
  if v ~ '(brainscroll|drscroll|dr_scroll|admin|moderator|support|official)'
     or v ~ '(fuck|shit|cunt|nigg|fag|bitch|whore|slut|rape|nazi|hitler|porn|dick|cock|pussy|penis|vagina|kkk)' then
    raise exception 'USERNAME_NOT_ALLOWED' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles where username = v and id <> v_uid) then raise exception 'USERNAME_TAKEN' using errcode = '23505'; end if;
  update public.profiles set username = v where id = v_uid;
  return jsonb_build_object('username', v);
end $$;

-- Exact-username search: only ever one result, never a directory.
create or replace function public.find_user(p_username text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select public.social_card(p.id) from public.profiles p
  where p.username = lower(trim(p_username)) and p.id <> auth.uid() and not public.blocked_between(auth.uid(), p.id)
$$;

-- Friends now, both ways.
create or replace function public.befriend(p_a uuid, p_b uuid) returns void
language sql security definer set search_path = public, pg_temp as $$
  delete from public.friend_requests where (user_id = p_a and to_id = p_b) or (user_id = p_b and to_id = p_a);
  insert into public.friendships (user_id, friend_id) values (p_a, p_b), (p_b, p_a) on conflict do nothing;
$$;
revoke execute on function public.befriend(uuid, uuid) from public, anon, authenticated;

-- Sends a request, or accepts theirs if they already asked. Returns 'requested' or 'friends'.
create or replace function public.send_friend_request(p_user uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_user = v_uid or not exists (select 1 from public.profiles where id = p_user) or public.blocked_between(v_uid, p_user) then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.friendships where user_id = v_uid and friend_id = p_user) then return 'friends'; end if;
  if exists (select 1 from public.friend_requests where user_id = p_user and to_id = v_uid) then
    perform public.befriend(v_uid, p_user);
    return 'friends';
  end if;
  if (select count(*) from public.friend_requests where user_id = v_uid) >= 50 then raise exception 'TOO_MANY_REQUESTS' using errcode = '54000'; end if;
  insert into public.friend_requests (user_id, to_id) values (v_uid, p_user) on conflict do nothing;
  return 'requested';
end $$;

create or replace function public.respond_friend_request(p_from uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if not exists (select 1 from public.friend_requests where user_id = p_from and to_id = v_uid) then return; end if;
  if p_accept then perform public.befriend(v_uid, p_from);
  else delete from public.friend_requests where user_id = p_from and to_id = v_uid;
  end if;
end $$;

-- Unfriends, or cancels a request sent to them.
create or replace function public.remove_friend(p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  delete from public.friendships where (user_id = v_uid and friend_id = p_user) or (user_id = p_user and friend_id = v_uid);
  delete from public.friend_requests where user_id = v_uid and to_id = p_user;
end $$;

-- Opening someone's invite link: friends at once (sharing the link was their yes).
create or replace function public.accept_invite(p_code text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_from uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select id into v_from from public.profiles where invite_code = upper(trim(p_code));
  if v_from is null or v_from = v_uid or public.blocked_between(v_uid, v_from) then raise exception 'INVITE_NOT_FOUND' using errcode = 'P0002'; end if;
  perform public.befriend(v_uid, v_from);
  return public.social_card(v_from);
end $$;

create or replace function public.block_user(p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_user = v_uid then return; end if;
  insert into public.user_blocks (user_id, blocked_id) values (v_uid, p_user) on conflict do nothing;
  delete from public.friendships where (user_id = v_uid and friend_id = p_user) or (user_id = p_user and friend_id = v_uid);
  delete from public.friend_requests where (user_id = v_uid and to_id = p_user) or (user_id = p_user and to_id = v_uid);
  delete from public.feed_reactions where (user_id = p_user and owner_id = v_uid) or (user_id = v_uid and owner_id = p_user);
end $$;

create or replace function public.unblock_user(p_user uuid) returns void
language sql security definer set search_path = public, pg_temp as $$
  delete from public.user_blocks where user_id = auth.uid() and blocked_id = p_user;
$$;

create or replace function public.report_user(p_user uuid, p_reason text, p_note text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if (select count(*) from public.user_reports where user_id = v_uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = '54000';
  end if;
  insert into public.user_reports (user_id, reported_id, reason, note) values (v_uid, p_user, p_reason, nullif(trim(p_note), ''));
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Profiles and the feed
-- ─────────────────────────────────────────────────────────────────────────────

-- A friend's or league mate's profile (or your own), to compare brains.
create or replace function public.get_social_profile(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_rel text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  v_rel := case
    when p_user = v_uid then 'you'
    when exists (select 1 from public.friendships where user_id = v_uid and friend_id = p_user) then 'friend'
    when exists (select 1 from public.friend_requests where user_id = v_uid and to_id = p_user) then 'requested'
    when exists (select 1 from public.friend_requests where user_id = p_user and to_id = v_uid) then 'asked_you'
    when exists (select 1 from public.social_circle(v_uid) c where c.user_id = p_user) then 'league'
  end;
  if v_rel is null or (v_rel <> 'you' and public.blocked_between(v_uid, p_user)) then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;
  return public.social_card(p_user) || jsonb_build_object(
    'relation', v_rel,
    'total_xp', (select coalesce(sum(amount), 0) from public.xp_events where user_id = p_user),
    'streak', public.learning_streak(p_user),
    'trophies', (
      select coalesce(jsonb_agg(t), '[]') from (
        select x ->> 'trophy_id' as trophy_id, x ->> 'earned_at' as earned_at from jsonb_array_elements(public.milestone_trophies(p_user)) x
        union all
        select trophy_id, earned_at::text from public.user_trophies where user_id = p_user
      ) t),
    'skills', (select coalesce(jsonb_object_agg(skill_id, highest_cleared), '{}') from public.user_skill_progress where user_id = p_user and highest_cleared > 0)
  );
end $$;

-- Streak milestones worth a feed moment. Mirrors STREAK_FEED_MILESTONES (core).
create or replace function public.streak_feed_milestones() returns int[]
language sql immutable as $$ select array[3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365, 500, 750, 1000] $$;

-- The last 14 days of moments from you, your friends and your league mates, newest first.
create or replace function public.get_feed() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_since timestamptz := now() - interval '14 days';
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  return (
    with people as (
      select v_uid as uid, false as is_friend union all select user_id, is_friend from public.social_circle(v_uid)
    ),
    items as (
      -- Trophies (milestones, mastery, subjects) and quest trophies.
      select p.uid, 'trophy' as kind, 'trophy:' || (x ->> 'trophy_id') as item_key, (x ->> 'earned_at')::timestamptz as at,
             jsonb_build_object('trophy_id', x ->> 'trophy_id') as data
      from people p cross join lateral jsonb_array_elements(public.milestone_trophies(p.uid)) x
      where (x ->> 'earned_at')::timestamptz >= v_since
      union all
      select p.uid, 'trophy', 'trophy:' || t.trophy_id, t.earned_at, jsonb_build_object('trophy_id', t.trophy_id, 'name', t.name)
      from people p join public.user_trophies t on t.user_id = p.uid where t.earned_at >= v_since
      -- Chapters finished: every 10th level.
      union all
      select p.uid, 'chapter', 'chapter:' || lp.level_id, lp.completed_at,
             jsonb_build_object('skill_id', l.skill_id, 'chapter', l.number / 10)
      from people p join public.user_level_progress lp on lp.user_id = p.uid and lp.completed_at >= v_since
      join public.levels l on l.id = lp.level_id and l.number % 10 = 0
      -- Streak milestones: the day a run reached 3, 7, 14, 30 ... days.
      union all
      select r.uid, 'streak', 'streak:' || r.k || ':' || r.d, r.at, jsonb_build_object('days', r.k)
      from (
        select uid, d, at, row_number() over (partition by uid, grp order by d)::int as k
        from (
          select p.uid, ld.day as d, ld.first_at as at, ld.day - (row_number() over (partition by p.uid order by ld.day))::int as grp
          from people p join public.user_learning_days ld on ld.user_id = p.uid
        ) runs
      ) r
      where r.at >= v_since and r.k = any (public.streak_feed_milestones())
      -- League podiums.
      union all
      select p.uid, 'league', 'league:' || e.idempotency_key, e.created_at, jsonb_build_object('reason', e.reason, 'xp', e.amount)
      from people p join public.xp_events e on e.user_id = p.uid and e.type = 'LEAGUE_FINISH' and e.created_at >= v_since
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'owner', public.social_card(i.uid) || jsonb_build_object('you', i.uid = v_uid, 'friend', pe.is_friend),
      'kind', i.kind, 'key', i.item_key, 'at', i.at, 'data', i.data,
      'reactions', (select coalesce(jsonb_object_agg(reaction, n), '{}') from (
                     select reaction, count(*) as n from public.feed_reactions fr
                     where fr.owner_id = i.uid and fr.item_key = i.item_key and not public.blocked_between(v_uid, fr.user_id)
                     group by reaction) rc),
      'mine', (select reaction from public.feed_reactions fr where fr.owner_id = i.uid and fr.item_key = i.item_key and fr.user_id = v_uid)
    ) order by i.at desc), '[]')
    from (select * from items order by at desc limit 60) i join people pe on pe.uid = i.uid
  );
end $$;

-- A Dr. Scroll reaction on someone's moment (null takes it back). Only for people you can see.
create or replace function public.react(p_owner uuid, p_item_key text, p_reaction text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_owner = v_uid or not exists (select 1 from public.social_circle(v_uid) c where c.user_id = p_owner) then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_reaction is null then
    delete from public.feed_reactions where owner_id = p_owner and item_key = p_item_key and user_id = v_uid;
  else
    insert into public.feed_reactions (user_id, owner_id, item_key, reaction) values (v_uid, p_owner, p_item_key, p_reaction)
    on conflict (owner_id, item_key, user_id) do update set reaction = excluded.reaction, created_at = now();
  end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array['get_league()', 'get_social()', 'set_username(text)', 'find_user(text)', 'send_friend_request(uuid)',
    'respond_friend_request(uuid, boolean)', 'remove_friend(uuid)', 'accept_invite(text)', 'block_user(uuid)', 'unblock_user(uuid)',
    'report_user(uuid, text, text)', 'get_social_profile(uuid)', 'get_feed()', 'react(uuid, text, text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
