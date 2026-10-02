-- Social push notifications (owner, 2026-10-02): the things friends and leagues do
-- that are worth a ping, sent as real push notifications.
--
-- - Someone wants to be your friend; you're friends now (a request accepted, an
--   invite used, or two requests crossing).
-- - Someone just passed you in your weekly league (at most once a day).
-- - Your league week ended: your place, and the prize if you won one.
-- - Someone reacted to one of your moments in the feed (collapsed into one note).
--
-- Events land in notification_outbox (one row each, written by triggers, so no
-- RPC can forget to). The send-push Edge Function claims a batch every few
-- minutes with claim_social_pushes(), which applies the rules and renders
-- nothing: the copy lives in functions/_shared/push.ts. The rules:
-- - only with social notifications on (profiles.social_notifications, default on)
--   and a registered device (push_tokens);
-- - only between 9 am and 9 pm in the learner's own time zone; later events wait;
-- - at most 4 a day, local day; one push per kind per batch (several reactions
--   become "@a and 2 others");
-- - a note that's waited more than a day is dropped (two for a league result).
-- Never guilt, threats or fake deadlines (the copy test in scripts/test/push.test.ts).
-- Mirrors nothing in core: the app only registers tokens and holds the switch.

-- ─────────────────────────────────────────────────────────────────────────────
-- Devices and the switch
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles add column social_notifications boolean not null default true;

-- Expo push tokens, one row per device. A token moves to whoever signs in on it.
create table public.push_tokens (
  token text primary key check (token ~ '^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]{10,}\]$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from public, anon, authenticated;

create table public.notification_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('friend_request', 'friend_new', 'passed', 'league_result', 'reaction')),
  params jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'expired')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notification_outbox_pending on public.notification_outbox (created_at) where status = 'pending';
create index notification_outbox_user on public.notification_outbox (user_id, sent_at);
alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from public, anon, authenticated;

create or replace function public.register_push_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_token !~ '^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]{10,}\]$' or p_platform not in ('ios', 'android') then
    raise exception 'INVALID_TOKEN' using errcode = '22023';
  end if;
  insert into public.push_tokens (token, user_id, platform) values (p_token, v_uid, p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

-- Signing out: this device stops getting this account's notes.
create or replace function public.unregister_push_token(p_token text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
end $$;

create or replace function public.set_social_notifications(p_on boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  update public.profiles set social_notifications = coalesce(p_on, true) where id = auth.uid();
  return jsonb_build_object('social_notifications', coalesce(p_on, true));
end $$;

revoke execute on function public.register_push_token(text, text), public.unregister_push_token(text), public.set_social_notifications(boolean) from public, anon;
grant execute on function public.register_push_token(text, text), public.unregister_push_token(text), public.set_social_notifications(boolean) to authenticated;

-- get_social's "me" gains the switch.
create or replace function public.get_social() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  perform public.ensure_social_identity(v_uid);
  return jsonb_build_object(
    'me', (select jsonb_build_object('id', id, 'username', username, 'invite_code', invite_code, 'avatar', avatar, 'social_notifications', social_notifications)
           from public.profiles where id = v_uid),
    'friends', (select coalesce(jsonb_agg(public.social_card(f.friend_id) order by public.weekly_xp(f.friend_id, public.league_week_start(now())) desc), '[]')
                from public.friendships f where f.user_id = v_uid),
    'incoming', (select coalesce(jsonb_agg(public.social_card(r.user_id) order by r.created_at), '[]')
                 from public.friend_requests r where r.to_id = v_uid and not public.blocked_between(v_uid, r.user_id)),
    'outgoing', (select coalesce(jsonb_agg(public.social_card(r.to_id) order by r.created_at), '[]')
                 from public.friend_requests r where r.user_id = v_uid)
  );
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Events
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.enqueue_push(p_user uuid, p_kind text, p_params jsonb) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.notification_outbox (user_id, kind, params) values (p_user, p_kind, coalesce(p_params, '{}'))
$$;

-- A request: the other side hears about it.
create or replace function public.push_on_friend_request() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.blocked_between(new.user_id, new.to_id) then
    perform public.enqueue_push(new.to_id, 'friend_request',
      jsonb_build_object('user_id', new.user_id, 'username', (select username from public.profiles where id = new.user_id)));
  end if;
  return new;
end $$;
create trigger friend_requests_push after insert on public.friend_requests for each row execute function public.push_on_friend_request();

-- A friendship is two rows, written by whoever made it happen (accepting, opening an
-- invite, or a request crossing theirs). The other person hears "you're friends".
create or replace function public.push_on_friendship() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null and new.friend_id = auth.uid() then
    perform public.enqueue_push(new.user_id, 'friend_new',
      jsonb_build_object('user_id', new.friend_id, 'username', (select username from public.profiles where id = new.friend_id)));
  end if;
  return new;
end $$;
create trigger friendships_push after insert on public.friendships for each row execute function public.push_on_friendship();

-- A reaction (a new one, not a change of pose): the owner hears about it.
create or replace function public.push_on_reaction() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.user_id <> new.owner_id then
    perform public.enqueue_push(new.owner_id, 'reaction',
      jsonb_build_object('user_id', new.user_id, 'username', (select username from public.profiles where id = new.user_id)));
  end if;
  return new;
end $$;
create trigger feed_reactions_push after insert on public.feed_reactions for each row execute function public.push_on_reaction();

-- XP that lifts someone past league mates: each one passed hears about it, at most
-- once a day, and only if they've earned XP this week themselves (no pinging people
-- who aren't playing). League prizes don't count, as everywhere in leagues.
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
    select lm.user_id, public.weekly_xp(lm.user_id, v_week) as xp from public.league_members lm
    where lm.league_id = v_league and lm.user_id <> new.user_id
  loop
    if m.xp > 0 and m.xp >= v_old and m.xp < v_new and not public.blocked_between(m.user_id, new.user_id)
       and not exists (select 1 from public.notification_outbox o where o.user_id = m.user_id and o.kind = 'passed' and o.created_at > now() - interval '20 hours') then
      v_name := coalesce(v_name, (select username from public.profiles where id = new.user_id));
      perform public.enqueue_push(m.user_id, 'passed',
        jsonb_build_object('user_id', new.user_id, 'username', v_name, 'gap', v_new - m.xp, 'league_id', v_league));
    end if;
  end loop;
  return new;
end $$;
create trigger xp_events_push after insert on public.xp_events for each row execute function public.push_on_xp();

-- League results: finalizing a week (unchanged payouts) now also tells everyone who
-- played that week where they finished.
create or replace function public.finalize_leagues_of(p_uid uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s public.app_settings;
  lg record;
  r record;
  prizes int[];
  n int;
  v_prize int;
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
      v_prize := 0;
      if r.place <= 3 and r.xp > 0 and n > r.place then
        insert into public.xp_events (user_id, type, amount, reason, idempotency_key)
        values (r.user_id, 'LEAGUE_FINISH', prizes[r.place], 'league week ' || lg.week_start || ': place ' || r.place, 'league_finish:' || lg.id)
        on conflict (user_id, idempotency_key) do nothing;
        v_prize := prizes[r.place];
      end if;
      if r.xp > 0 then
        perform public.enqueue_push(r.user_id, 'league_result',
          jsonb_build_object('league_id', lg.id, 'place', r.place, 'of', n, 'prize', v_prize));
      end if;
    end loop;
    update public.leagues set finalized_at = now() where id = lg.id;
  end loop;
end $$;
revoke execute on function public.finalize_leagues_of(uuid) from public, anon, authenticated;

-- Weeks used to close only when someone opened Social. For the result notes to go
-- out on Monday, send-push closes every finished week first.
create or replace function public.finalize_due_leagues() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid; n int := 0;
begin
  for v_uid in
    select distinct on (l.id) m.user_id from public.leagues l join public.league_members m on m.league_id = l.id
    where l.finalized_at is null and l.week_start + 7 <= public.league_week_start(now())
  loop
    perform public.finalize_leagues_of(v_uid);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Sending
-- ─────────────────────────────────────────────────────────────────────────────

-- Claims what may go out now and marks it sent. Returns one entry per learner and
-- kind: { user_id, kind, tokens, items: [params...] } (newest item first).
create or replace function public.claim_social_pushes(p_limit int default 500) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_out jsonb := '[]';
  g record;
  v_ids bigint[];
begin
  -- Old notes are dropped rather than sent late.
  update public.notification_outbox set status = 'expired'
  where status = 'pending' and created_at < now() - case when kind = 'league_result' then interval '48 hours' else interval '24 hours' end;
  -- Nobody to tell: switched off, or no device.
  update public.notification_outbox o set status = 'skipped'
  where o.status = 'pending'
    and (not (select p.social_notifications from public.profiles p where p.id = o.user_id)
         or not exists (select 1 from public.push_tokens t where t.user_id = o.user_id));

  for g in
    with pending as (
      select o.*, p.timezone from public.notification_outbox o join public.profiles p on p.id = o.user_id
      where o.status = 'pending'
        and extract(hour from now() at time zone p.timezone) between 9 and 20
      order by o.created_at
      limit p_limit
      for update of o skip locked
    ),
    sent_today as (
      select o.user_id, count(distinct (o.kind, o.sent_at)) as n
      from public.notification_outbox o join public.profiles p on p.id = o.user_id
      where o.status = 'sent' and (o.sent_at at time zone p.timezone)::date = (now() at time zone p.timezone)::date
        and o.user_id in (select user_id from pending)
      group by o.user_id
    ),
    groups as (
      select pe.user_id, pe.kind, array_agg(pe.id order by pe.created_at desc) as ids,
             jsonb_agg(pe.params order by pe.created_at desc) as items, min(pe.created_at) as first_at
      from pending pe group by pe.user_id, pe.kind
    ),
    ranked as (
      select gr.*, row_number() over (partition by gr.user_id order by gr.first_at) as k, coalesce(st.n, 0) as already
      from groups gr left join sent_today st on st.user_id = gr.user_id
    )
    select r.* from ranked r where r.already + r.k <= 4
  loop
    update public.notification_outbox set status = 'sent', sent_at = now() where id = any (g.ids);
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'user_id', g.user_id, 'kind', g.kind, 'items', g.items,
      'tokens', (select coalesce(jsonb_agg(t.token), '[]') from public.push_tokens t where t.user_id = g.user_id)));
  end loop;
  return v_out;
end $$;

-- Expo said these devices are gone (the app was deleted): stop sending to them.
create or replace function public.forget_push_tokens(p_tokens text[]) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  delete from public.push_tokens where token = any (p_tokens);
  get diagnostics n = row_count;
  return n;
end $$;

-- Sent notes are kept a week (for the daily cap), then cleared.
create or replace function public.prune_outbox() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  delete from public.notification_outbox where status <> 'pending' and created_at < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.enqueue_push(uuid, text, jsonb), public.push_on_friend_request(), public.push_on_friendship(),
  public.push_on_reaction(), public.push_on_xp(), public.finalize_due_leagues(), public.claim_social_pushes(int),
  public.forget_push_tokens(text[]), public.prune_outbox() from public, anon, authenticated;
grant execute on function public.finalize_due_leagues(), public.claim_social_pushes(int), public.forget_push_tokens(text[]), public.prune_outbox() to service_role;
