-- Weekly Knowledge Quests (docs/social-expansion.md, "v1, as built").
--
-- One quest a week, live from its Monday 00:00 UTC for seven days. Progress is
-- never stored: it's the LEVEL_COMPLETE rows in xp_events for each requirement's
-- skill inside the learner's counting window, capped at the requirement. When
-- every requirement is met, a 3-question Final Round unlocks (questions from the
-- levels that counted). Finishing pays the quest's XP bonus once; the trophy is
-- only for finishing inside the live week (owner, 2026-09-29). Afterwards the
-- quest is in the Archive: one active Archive quest at a time, XP but no trophy.

alter type public.xp_event_type add value if not exists 'QUEST_COMPLETE';

alter table public.app_settings add column quest_final_round_size int not null default 3;

create table public.quests (
  id text primary key,
  title text not null,
  tagline text not null,
  art text not null,
  starts_at timestamptz not null unique,
  ends_at timestamptz not null,
  xp_reward int not null check (xp_reward in (50, 75, 100)),
  trophy_id text not null unique,
  trophy_name text not null,
  status public.content_status not null
);

create table public.quest_requirements (
  quest_id text not null references public.quests (id) on delete cascade,
  skill_id text not null references public.skills (id),
  new_levels int not null check (new_levels between 1 and 10),
  sort_order int not null,
  primary key (quest_id, skill_id)
);

-- A learner's own run at a quest. Levels count when they fall in
-- [started_at, quest ends_at) or at/after resumed_at (an Archive run).
create table public.user_quests (
  user_id uuid not null references public.profiles (id) on delete cascade,
  quest_id text not null references public.quests (id) on delete cascade,
  started_at timestamptz not null,
  resumed_at timestamptz,
  archive_active boolean not null default false,
  final_round_question_ids text[],
  completed_at timestamptz,
  live_clear boolean,
  primary key (user_id, quest_id)
);
create unique index user_quests_one_archive on public.user_quests (user_id) where archive_active;

create table public.user_quest_answers (
  user_id uuid not null,
  quest_id text not null,
  question_id text not null references public.questions (id) on delete cascade,
  attempt_count int not null default 0,
  resolved_at timestamptz,
  primary key (user_id, quest_id, question_id),
  foreign key (user_id, quest_id) references public.user_quests (user_id, quest_id) on delete cascade
);

create table public.user_trophies (
  user_id uuid not null references public.profiles (id) on delete cascade,
  trophy_id text not null,
  name text not null,
  quest_id text references public.quests (id) on delete set null,
  earned_at timestamptz not null default now(),
  primary key (user_id, trophy_id)
);

alter table public.quests enable row level security;
alter table public.quest_requirements enable row level security;
alter table public.user_quests enable row level security;
alter table public.user_quest_answers enable row level security;
alter table public.user_trophies enable row level security;
create policy "read published quests" on public.quests for select using (status = 'published');
create policy "read quest requirements" on public.quest_requirements for select
  using (exists (select 1 from public.quests q where q.id = quest_id and q.status = 'published'));
create policy "own quests" on public.user_quests for select using (user_id = auth.uid());
create policy "own quest answers" on public.user_quest_answers for select using (user_id = auth.uid());
create policy "own trophies" on public.user_trophies for select using (user_id = auth.uid());

-- ── Content: quests.json, via the importer (service role) ──
create or replace function public.import_quests(p jsonb, p_publish_drafts boolean default false) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  x jsonb;
  n int := 0;
begin
  for x in select * from jsonb_array_elements(coalesce(p, '[]')) loop
    n := n + 1;
    insert into public.quests (id, title, tagline, art, starts_at, ends_at, xp_reward, trophy_id, trophy_name, status)
    values (x ->> 'id', x ->> 'title', x ->> 'tagline', x ->> 'art',
            (x ->> 'startsOn')::date::timestamp at time zone 'UTC',
            ((x ->> 'startsOn')::date + 7)::timestamp at time zone 'UTC',
            (x ->> 'xpReward')::int, x -> 'trophy' ->> 'id', x -> 'trophy' ->> 'name',
            public.effective_status(x ->> 'status', p_publish_drafts))
    on conflict (id) do update set title = excluded.title, tagline = excluded.tagline, art = excluded.art,
      starts_at = excluded.starts_at, ends_at = excluded.ends_at, xp_reward = excluded.xp_reward,
      trophy_id = excluded.trophy_id, trophy_name = excluded.trophy_name, status = excluded.status;
    delete from public.quest_requirements where quest_id = x ->> 'id';
    insert into public.quest_requirements (quest_id, skill_id, new_levels, sort_order)
    select x ->> 'id', r.value ->> 'skillId', (r.value ->> 'newLevels')::int, r.ordinality::int
    from jsonb_array_elements(x -> 'requirements') with ordinality r;
  end loop;
  return jsonb_build_object('quests', n);
end $$;
revoke execute on function public.import_quests(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.import_quests(jsonb, boolean) to service_role;

-- ── Progress: computed from the ledger ──

-- The levels that count for one run: per requirement, the first N first-clears
-- of that skill inside the window, oldest first.
create or replace function public.quest_counted_levels(p_uid uuid, p_quest text, p_started timestamptz, p_resumed timestamptz)
returns table (skill_id text, level_id text, created_at timestamptz, sort_order int)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.skill_id, c.level_id, c.created_at, c.sort_order from (
    select e.skill_id, e.level_id, e.created_at, r.sort_order, r.new_levels,
           row_number() over (partition by e.skill_id order by e.created_at, e.id) as n
    from public.quest_requirements r
    join public.quests q on q.id = r.quest_id
    join public.xp_events e on e.user_id = p_uid and e.type = 'LEVEL_COMPLETE' and e.skill_id = r.skill_id
    where r.quest_id = p_quest
      and ((e.created_at >= p_started and e.created_at < q.ends_at) or (p_resumed is not null and e.created_at >= p_resumed))
  ) c where c.n <= c.new_levels
$$;
revoke execute on function public.quest_counted_levels(uuid, text, timestamptz, timestamptz) from public, anon, authenticated;

-- One quest as the learner sees it: state, per-requirement progress, Final Round.
create or replace function public.quest_view(p_uid uuid, q public.quests) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  uq public.user_quests;
  v_live boolean := now() >= q.starts_at and now() < q.ends_at;
  v_counting boolean;
  v_started timestamptz;
  v_reqs jsonb;
  v_done boolean;
begin
  select * into uq from public.user_quests where user_id = p_uid and quest_id = q.id;
  -- A live quest counts from its start for everyone; an Archive quest only while it's the active one.
  v_counting := v_live or coalesce(uq.archive_active, false) or uq.completed_at is not null;
  v_started := coalesce(uq.started_at, q.starts_at);
  select coalesce(jsonb_agg(jsonb_build_object('skill_id', r.skill_id, 'required', r.new_levels,
           'done', case when v_counting then (select count(*) from public.quest_counted_levels(p_uid, q.id, v_started, uq.resumed_at) c where c.skill_id = r.skill_id) else 0 end)
           order by r.sort_order), '[]')
    into v_reqs
  from public.quest_requirements r where r.quest_id = q.id;
  v_done := v_counting and not exists (select 1 from jsonb_array_elements(v_reqs) x where (x ->> 'done')::int < (x ->> 'required')::int);
  return jsonb_build_object(
    'id', q.id,
    'state', case when uq.completed_at is not null then 'completed' when v_live then 'live' else 'archive' end,
    'starts_at', q.starts_at, 'ends_at', q.ends_at,
    'active', v_live or coalesce(uq.archive_active, false),
    'requirements', v_reqs,
    'final_round_unlocked', v_done,
    'final_round', case when uq.final_round_question_ids is null then null else jsonb_build_object(
      'question_ids', to_jsonb(uq.final_round_question_ids),
      'resolved', (select coalesce(jsonb_agg(a.question_id), '[]') from public.user_quest_answers a
                   where a.user_id = p_uid and a.quest_id = q.id and a.resolved_at is not null)) end,
    'completed_at', uq.completed_at,
    'live_clear', uq.live_clear);
end $$;
revoke execute on function public.quest_view(uuid, public.quests) from public, anon, authenticated;

-- Every quest that has started (live first, then the Archive, newest first), and the learner's trophies.
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
    'trophies', (select coalesce(jsonb_agg(jsonb_build_object('trophy_id', t.trophy_id, 'name', t.name, 'quest_id', t.quest_id, 'earned_at', t.earned_at)
                   order by t.earned_at desc), '[]') from public.user_trophies t where t.user_id = v_uid));
end $$;
revoke execute on function public.get_quests() from public, anon;
grant execute on function public.get_quests() to authenticated;

-- Make an Archive quest the active one. Continuing your own unfinished live
-- week keeps what you did during it; otherwise counting starts now. The quest
-- you switch away from loses its unfinished progress.
create or replace function public.start_quest(p_quest_id text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  q public.quests;
  uq public.user_quests;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  perform 1 from public.profiles where id = v_uid for update;
  select * into q from public.quests where id = p_quest_id and status = 'published';
  if not found then raise exception 'QUEST_NOT_FOUND'; end if;
  if now() < q.ends_at then return public.quest_view(v_uid, q); end if; -- live (or upcoming): nothing to start

  select * into uq from public.user_quests where user_id = v_uid and quest_id = q.id;
  if uq.completed_at is not null or coalesce(uq.archive_active, false) then return public.quest_view(v_uid, q); end if;

  -- Switching: the quest you leave loses its unfinished progress.
  delete from public.user_quests where user_id = v_uid and archive_active and completed_at is null;
  if uq.quest_id is not null then
    update public.user_quests set archive_active = true, resumed_at = now() where user_id = v_uid and quest_id = q.id;
  elsif exists (select 1 from public.quest_counted_levels(v_uid, q.id, q.starts_at, null)) then
    -- Your own live week, unfinished: keep what you did during it.
    insert into public.user_quests (user_id, quest_id, started_at, resumed_at, archive_active) values (v_uid, q.id, q.starts_at, now(), true);
  else
    insert into public.user_quests (user_id, quest_id, started_at, resumed_at, archive_active) values (v_uid, q.id, now(), now(), true);
  end if;
  return public.quest_view(v_uid, q);
end $$;
revoke execute on function public.start_quest(text) from public, anon;
grant execute on function public.start_quest(text) to authenticated;

-- Open the Final Round: picks its questions once (fixed afterwards) from the
-- levels that counted, one per requirement skill in order, preferring each
-- level's `connection` question.
create or replace function public.open_final_round(p_quest_id text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  q public.quests;
  uq public.user_quests;
  v_view jsonb;
  v_ids text[];
  v_size int := (select quest_final_round_size from public.app_settings);
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  perform 1 from public.profiles where id = v_uid for update;
  select * into q from public.quests where id = p_quest_id and status = 'published' and starts_at <= now();
  if not found then raise exception 'QUEST_NOT_FOUND'; end if;
  v_view := public.quest_view(v_uid, q);
  if not (v_view ->> 'final_round_unlocked')::boolean then raise exception 'FINAL_ROUND_LOCKED'; end if;

  select * into uq from public.user_quests where user_id = v_uid and quest_id = q.id;
  if uq.quest_id is null then
    insert into public.user_quests (user_id, quest_id, started_at) values (v_uid, q.id, q.starts_at) returning * into uq;
  end if;
  if uq.final_round_question_ids is null then
    select array_agg(pick.question_id order by pick.sort_order) into v_ids from (
      select distinct on (c.skill_id) c.skill_id, c.sort_order,
             (select qq.id from public.questions qq
              where qq.level_id = c.level_id
              order by exists (select 1 from jsonb_array_elements(coalesce(lr.bundle -> 'questions', '[]')) x
                               where x ->> 'id' = qq.id and x ->> 'purpose' = 'connection') desc, qq.id desc
              limit 1) as question_id
      from public.quest_counted_levels(v_uid, q.id, uq.started_at, uq.resumed_at) c
      join public.levels l on l.id = c.level_id
      join public.level_revisions lr on lr.level_id = l.id and lr.revision = l.current_revision
      order by c.skill_id, c.created_at desc
    ) pick
    where pick.sort_order in (select r.sort_order from public.quest_requirements r where r.quest_id = q.id order by r.sort_order limit v_size);
    update public.user_quests set final_round_question_ids = v_ids where user_id = v_uid and quest_id = q.id;
    insert into public.user_quest_answers (user_id, quest_id, question_id) select v_uid, q.id, unnest(v_ids) on conflict do nothing;
  end if;
  return public.quest_view(v_uid, q);
end $$;
revoke execute on function public.open_final_round(text) from public, anon;
grant execute on function public.open_final_round(text) to authenticated;

-- Answer one Final Round question. Wrong answers are corrected with the
-- question's source cards, as in a level; there's no first-try scoring.
create or replace function public.answer_final_round(p_quest_id text, p_question_id text, p_option_id text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_correct boolean;
  v_rationale text;
  v_explanation text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  perform 1 from public.user_quest_answers a
  join public.user_quests uq on uq.user_id = a.user_id and uq.quest_id = a.quest_id
  where a.user_id = v_uid and a.quest_id = p_quest_id and a.question_id = p_question_id and uq.completed_at is null
  for update of a;
  if not found then raise exception 'QUESTION_NOT_IN_FINAL_ROUND'; end if;

  select q.explanation into v_explanation from public.questions q where q.id = p_question_id;
  select coalesce(o.correct, false), o.rationale into v_correct, v_rationale
  from (select 1) one left join public.answer_options o on o.question_id = p_question_id and o.option_id = p_option_id;

  update public.user_quest_answers set attempt_count = attempt_count + 1,
    resolved_at = coalesce(resolved_at, case when v_correct then now() end)
  where user_id = v_uid and quest_id = p_quest_id and question_id = p_question_id;
  return jsonb_build_object('correct', v_correct, 'resolved', v_correct,
    'rationale', case when v_correct then null else v_rationale end,
    'explanation', case when v_correct then v_explanation else null end);
end $$;
revoke execute on function public.answer_final_round(text, text, text) from public, anon;
grant execute on function public.answer_final_round(text, text, text) to authenticated;

-- Finish a quest once every Final Round question is resolved: the XP bonus
-- exactly once, and the trophy only inside the live week.
create or replace function public.complete_quest(p_quest_id text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  q public.quests;
  uq public.user_quests;
  v_live boolean;
  v_xp int := 0;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  perform 1 from public.profiles where id = v_uid for update;
  select * into q from public.quests where id = p_quest_id;
  select * into uq from public.user_quests where user_id = v_uid and quest_id = p_quest_id for update;
  if uq.quest_id is null or uq.final_round_question_ids is null then raise exception 'FINAL_ROUND_LOCKED'; end if;

  if uq.completed_at is null then
    if exists (select 1 from public.user_quest_answers where user_id = v_uid and quest_id = p_quest_id and resolved_at is null) then
      raise exception 'FINAL_ROUND_UNRESOLVED';
    end if;
    v_live := now() < q.ends_at;
    update public.user_quests set completed_at = now(), live_clear = v_live, archive_active = false
    where user_id = v_uid and quest_id = p_quest_id returning * into uq;
    insert into public.xp_events (user_id, type, amount, reason, idempotency_key)
    values (v_uid, 'QUEST_COMPLETE', q.xp_reward, q.id, 'quest_complete:' || q.id)
    on conflict (user_id, idempotency_key) do nothing;
    get diagnostics v_xp = row_count;
    v_xp := v_xp * q.xp_reward;
    if v_live then
      insert into public.user_trophies (user_id, trophy_id, name, quest_id) values (v_uid, q.trophy_id, q.trophy_name, q.id)
      on conflict do nothing;
    end if;
  end if;
  return jsonb_build_object('quest_id', q.id, 'xp_awarded', v_xp, 'live_clear', uq.live_clear,
    'trophy', case when uq.live_clear then jsonb_build_object('trophy_id', q.trophy_id, 'name', q.trophy_name) end);
end $$;
revoke execute on function public.complete_quest(text) from public, anon;
grant execute on function public.complete_quest(text) to authenticated;
