-- The username filter and learner moderation (owner, 2026-10-01).
--
-- Usernames are the one thing learners write that other learners see. Offensive
-- ones are refused when they're set (set_username), using a term list, the
-- usual normalisation against workarounds, and an allowlist of innocent words
-- that contain a term. Mirrors packages/core/src/usernameFilter.ts; a scripts
-- test keeps the lists identical:
-- - the name is split into parts at underscores, runs of one-letter parts joined
--   (f_u_c_k reads as one word);
-- - look-alike digits count as letters (sh1t), and any letter of a term may repeat;
-- - 'anywhere' terms are refused inside any part, except inside an 'allowed'
--   word (grape, therapist, scunthorpe);
-- - 'word' terms only as a whole part, since they hide in ordinary words
--   (cocktail, dickens, cucumber, sussex).
-- No list is complete: reports, and the admin's queue (which also lists existing
-- usernames that fail the filter), catch the rest. The admin can reset a
-- username to a fresh generated one.

create table public.username_terms (
  term text primary key check (term ~ '^[a-z]+$'),
  kind text not null check (kind in ('anywhere', 'word', 'allowed'))
);
alter table public.username_terms enable row level security;
revoke all on public.username_terms from public, anon, authenticated;

insert into public.username_terms (term, kind) values
  ('brainscroll', 'anywhere'), ('drscroll', 'anywhere'), ('admin', 'anywhere'), ('moderator', 'anywhere'), ('support', 'anywhere'), ('official', 'anywhere'),
  ('fuck', 'anywhere'), ('shit', 'anywhere'), ('cunt', 'anywhere'), ('bitch', 'anywhere'), ('bastard', 'anywhere'), ('asshole', 'anywhere'),
  ('twat', 'anywhere'), ('wank', 'anywhere'), ('motherf', 'anywhere'), ('porn', 'anywhere'), ('pussy', 'anywhere'), ('penis', 'anywhere'),
  ('vagina', 'anywhere'), ('dildo', 'anywhere'), ('blowjob', 'anywhere'), ('handjob', 'anywhere'), ('jizz', 'anywhere'), ('cumshot', 'anywhere'),
  ('orgasm', 'anywhere'), ('masturbat', 'anywhere'), ('whore', 'anywhere'), ('slut', 'anywhere'), ('milf', 'anywhere'), ('hentai', 'anywhere'),
  ('boner', 'anywhere'), ('erection', 'anywhere'), ('genital', 'anywhere'), ('testicle', 'anywhere'), ('clitor', 'anywhere'), ('nigg', 'anywhere'),
  ('faggot', 'anywhere'), ('fagg', 'anywhere'), ('retard', 'anywhere'), ('tranny', 'anywhere'), ('dyke', 'anywhere'), ('wetback', 'anywhere'),
  ('beaner', 'anywhere'), ('gook', 'anywhere'), ('raghead', 'anywhere'), ('towelhead', 'anywhere'), ('chingchong', 'anywhere'), ('rape', 'anywhere'),
  ('rapist', 'anywhere'), ('molest', 'anywhere'), ('pedo', 'anywhere'), ('paedo', 'anywhere'), ('incest', 'anywhere'), ('bestial', 'anywhere'),
  ('nazi', 'anywhere'), ('hitler', 'anywhere'), ('kkk', 'anywhere'), ('swastika', 'anywhere'), ('whitepower', 'anywhere'), ('killyourself', 'anywhere'),
  ('suicide', 'anywhere'), ('jihad', 'anywhere'), ('terrorist', 'anywhere'), ('genocide', 'anywhere'), ('lynch', 'anywhere'), ('ass', 'word'),
  ('arse', 'word'), ('dick', 'word'), ('cock', 'word'), ('cum', 'word'), ('sex', 'word'), ('anal', 'word'),
  ('anus', 'word'), ('tit', 'word'), ('tits', 'word'), ('boob', 'word'), ('boobs', 'word'), ('nude', 'word'),
  ('nudes', 'word'), ('horny', 'word'), ('xxx', 'word'), ('fag', 'word'), ('hoe', 'word'), ('thot', 'word'),
  ('spic', 'word'), ('chink', 'word'), ('kike', 'word'), ('coon', 'word'), ('heil', 'word'), ('sieg', 'word'),
  ('kys', 'word'), ('nonce', 'word'), ('prick', 'word'), ('piss', 'word'), ('damnit', 'word'), ('grape', 'allowed'),
  ('drape', 'allowed'), ('scrape', 'allowed'), ('trapeze', 'allowed'), ('parapet', 'allowed'), ('therapist', 'allowed'), ('scunthorpe', 'allowed'),
  ('niggle', 'allowed'), ('snigger', 'allowed'), ('sniggle', 'allowed'), ('torpedo', 'allowed'), ('pedometer', 'allowed'), ('encyclopedia', 'allowed'),
  ('cyclopedia', 'allowed'), ('expedition', 'allowed'), ('pedometric', 'allowed'), ('orthopedic', 'allowed'), ('pedology', 'allowed'), ('badminton', 'allowed'),
  ('lynchburg', 'allowed'), ('shitake', 'allowed'), ('supportive', 'allowed');

-- A term as a pattern where each letter may repeat: fuck also finds fuuuck.
create or replace function public.username_term_pattern(p_kind text) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select string_agg(regexp_replace(term, '([a-z])', '\1+', 'g'), '|') from public.username_terms where kind = p_kind
$$;

create or replace function public.username_blocked(p_name text) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_any text := public.username_term_pattern('anywhere');
  v_allowed text := public.username_term_pattern('allowed');
  v_parts text[] := '{}';
  v_run text := '';
  p text;
  v_read text;
begin
  foreach p in array string_to_array(lower(trim(p_name)), '_') loop
    if length(p) = 1 then
      v_run := v_run || p;
    else
      if v_run <> '' then v_parts := v_parts || v_run; end if;
      v_run := '';
      if p <> '' then v_parts := v_parts || p; end if;
    end if;
  end loop;
  if v_run <> '' then v_parts := v_parts || v_run; end if;

  foreach p in array v_parts loop
    v_read := regexp_replace(translate(p, '01345789', 'oieastbg'), '[^a-z]', '', 'g');
    -- Allowed words are cut out first, so grapes passes and grape_rapist doesn't.
    if v_any is not null and regexp_replace(v_read, coalesce(v_allowed, '^$'), '_', 'g') ~ v_any then return true; end if;
    if exists (select 1 from public.username_terms t
               where t.kind = 'word'
                 and (t.term in (v_read, regexp_replace(v_read, '(.)\1+', '\1', 'g')) or t.term = any (regexp_split_to_array(p, '[^a-z]+')))) then
      return true;
    end if;
  end loop;
  return false;
end $$;
revoke execute on function public.username_term_pattern(text), public.username_blocked(text) from public, anon, authenticated;

create or replace function public.set_username(p_username text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v text := lower(trim(p_username));
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if v !~ '^[a-z0-9_]{3,20}$' then raise exception 'USERNAME_INVALID' using errcode = '22023'; end if;
  if public.username_blocked(v) then raise exception 'USERNAME_NOT_ALLOWED' using errcode = '22023'; end if;
  if exists (select 1 from public.profiles where username = v and id <> v_uid) then raise exception 'USERNAME_TAKEN' using errcode = '23505'; end if;
  update public.profiles set username = v where id = v_uid;
  return jsonb_build_object('username', v);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Moderation, for the Content Admin (service role only)
-- ─────────────────────────────────────────────────────────────────────────────

-- Reports about learners. The reporter is never shown, only who was reported and why.
create or replace function public.admin_user_reports(p_status public.report_status default 'open') returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'reported_id', r.reported_id, 'username', p.username, 'avatar', p.avatar, 'reason', r.reason, 'note', r.note,
    'status', r.status, 'created_at', r.created_at,
    'open_reports', (select count(*) from public.user_reports o where o.reported_id = r.reported_id and o.status = 'open')
  ) order by r.created_at), '[]')
  from public.user_reports r join public.profiles p on p.id = r.reported_id
  where p_status is null or r.status = p_status
$$;

create or replace function public.admin_set_user_report_status(p_id bigint, p_status public.report_status) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.user_reports set status = p_status where id = p_id
$$;

-- Existing usernames that fail the filter (set before a term was added, say).
create or replace function public.admin_flagged_usernames() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'username', username, 'avatar', avatar) order by username), '[]')
  from public.profiles where username is not null and public.username_blocked(username)
$$;

-- Replaces a learner's username with a fresh generated one, and closes the open username reports about them.
create or replace function public.admin_reset_username(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v text;
begin
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;
  v := public.generate_username();
  update public.profiles set username = v where id = p_user;
  update public.user_reports set status = 'fixed' where reported_id = p_user and reason = 'username' and status = 'open';
  return jsonb_build_object('username', v);
end $$;

revoke execute on function public.admin_user_reports(public.report_status), public.admin_set_user_report_status(bigint, public.report_status),
  public.admin_flagged_usernames(), public.admin_reset_username(uuid) from public, anon, authenticated;
grant execute on function public.admin_user_reports(public.report_status), public.admin_set_user_report_status(bigint, public.report_status),
  public.admin_flagged_usernames(), public.admin_reset_username(uuid) to service_role;
