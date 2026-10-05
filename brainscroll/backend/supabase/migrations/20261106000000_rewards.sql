-- Map chests, XP boosts and cosmetics (owner, 2026-10-05; docs/specs/REWARDS.md).
-- Mirrors core rewards.ts (rewards.test.ts / rewards.test.sql); keep the
-- cosmetic_items seed identical to core COSMETICS (scripts/test/rewards-sync.test.ts).
--
-- 1. One chest per chapter, after its 5th level, opened once (open_chest). It
--    rolls app_settings.chest_loot once: a timed XP boost, +2 Brainpower, or a
--    cosmetic not owned yet from a tier the learner's Knowledge Level reaches.
--    A roll that can't pay out becomes the 15-minute boost.
-- 2. Boosts wait until the learner starts one (start_boost), one at a time.
--    While it runs, a level's first clear pays 2x in its one LEVEL_COMPLETE
--    event (the perfect streak included, never past perfect_streak_max_percent),
--    so it counts toward the league.
-- 3. The look (set_look): one ring, one name style, one title (a chest title or
--    a skill's "<Skill> Master" once it has a Mastery star). One title shows: a
--    look title and a quest title take each other off. social_card carries them.

-- ── Settings ──
alter table public.app_settings
  add column chest_loot jsonb not null default
    '{"boost_15": 25, "boost_30": 15, "boost_60": 5, "brainpower": 25, "common": 15, "rare": 8, "epic": 5, "legendary": 2}',
  add column chest_level_in_chapter int not null default 5 check (chest_level_in_chapter between 1 and 10),
  add column chest_brainpower int not null default 2 check (chest_brainpower between 1 and 10),
  add column boost_percent int not null default 100 check (boost_percent between 0 and 100);

alter table public.brainpower_awards drop constraint brainpower_awards_kind_check;
alter table public.brainpower_awards add constraint brainpower_awards_kind_check
  check (kind in ('streak', 'trophy', 'chapter_review', 'perfect', 'quest_step', 'quest', 'chest'));

-- ── Catalog ──
create table public.cosmetic_items (
  id text primary key check (id ~ '^(ring|name|title)\.[a-z_]+$'),
  kind text not null check (kind in ('ring', 'name_style', 'title')),
  tier text not null check (tier in ('common', 'rare', 'epic', 'legendary')),
  name text not null
);
alter table public.cosmetic_items enable row level security;
create policy cosmetic_items_read on public.cosmetic_items for select to authenticated using (true);

insert into public.cosmetic_items (id, kind, tier, name) values
  ('ring.plum', 'ring', 'common', 'Plum'),
  ('ring.silver', 'ring', 'common', 'Silver'),
  ('ring.ocean', 'ring', 'rare', 'Ocean'),
  ('ring.gold', 'ring', 'rare', 'Gold'),
  ('ring.flame', 'ring', 'epic', 'Flame'),
  ('ring.aurora', 'ring', 'epic', 'Aurora'),
  ('ring.galaxy', 'ring', 'legendary', 'Galaxy'),
  ('ring.prism', 'ring', 'legendary', 'Prism'),
  ('name.plum', 'name_style', 'common', 'Plum'),
  ('name.silver', 'name_style', 'common', 'Silver'),
  ('name.ocean', 'name_style', 'rare', 'Ocean'),
  ('name.gold', 'name_style', 'rare', 'Gold'),
  ('name.ember', 'name_style', 'epic', 'Ember'),
  ('name.aurora', 'name_style', 'epic', 'Aurora'),
  ('name.shimmer', 'name_style', 'legendary', 'Shimmer'),
  ('name.holo', 'name_style', 'legendary', 'Holo'),
  ('title.curious_mind', 'title', 'common', 'Curious Mind'),
  ('title.bookworm', 'title', 'common', 'Bookworm'),
  ('title.scholar', 'title', 'rare', 'Scholar'),
  ('title.night_owl', 'title', 'rare', 'Night Owl'),
  ('title.sage', 'title', 'epic', 'Sage'),
  ('title.lucky_star', 'title', 'epic', 'Lucky Star'),
  ('title.polymath', 'title', 'legendary', 'Polymath'),
  ('title.living_legend', 'title', 'legendary', 'Living Legend');

-- The lowest Knowledge Level a tier comes out of a chest at (core TIER_MIN_KNOWLEDGE_LEVEL).
create or replace function public.cosmetic_tier_min_level(p_tier text) returns int
language sql immutable set search_path = public, pg_temp as $$
  select case p_tier when 'common' then 1 when 'rare' then 15 when 'epic' then 30 when 'legendary' then 50 end
$$;

-- ── Learner state (RPC-only) ──
create table public.user_chests (
  user_id uuid not null references public.profiles (id) on delete cascade,
  skill_id text not null references public.skills (id) on delete cascade,
  chapter int not null check (chapter >= 1),
  reward jsonb not null,
  opened_at timestamptz not null default now(),
  primary key (user_id, skill_id, chapter)
);
alter table public.user_chests enable row level security;

create table public.user_cosmetics (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null references public.cosmetic_items (id),
  source text not null,
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.user_cosmetics enable row level security;

create table public.user_boosts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  minutes int not null check (minutes in (15, 30, 60)),
  source text not null,
  started_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check ((started_at is null) = (ends_at is null))
);
alter table public.user_boosts enable row level security;
create index user_boosts_user on public.user_boosts (user_id, ends_at);

alter table public.profiles
  add column look_ring text references public.cosmetic_items (id),
  add column look_name_style text references public.cosmetic_items (id),
  add column look_title text check (look_title is null or look_title ~ '^title\.[a-z0-9_.]+$');

-- ── Helpers ──
create or replace function public.active_boost(p_uid uuid) returns public.user_boosts
language sql stable security definer set search_path = public, pg_temp as $$
  select * from public.user_boosts
  where user_id = p_uid and started_at <= now() and ends_at > now()
  order by started_at desc limit 1
$$;

-- "title.mastery.science.astronomy" → "skill.science.astronomy" (core masteryTitleSkill).
create or replace function public.mastery_title_skill(p_title text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select case when p_title like 'title.mastery.%' then 'skill.' || substr(p_title, length('title.mastery.') + 1) end
$$;

create or replace function public.owns_cosmetic(p_uid uuid, p_item text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when public.mastery_title_skill(p_item) is not null then exists (
      select 1 from public.user_skill_progress where user_id = p_uid and skill_id = public.mastery_title_skill(p_item) and stars >= 1)
    else exists (select 1 from public.user_cosmetics where user_id = p_uid and item_id = p_item)
  end
$$;

-- The title others see: a look title, else a quest title.
create or replace function public.shown_title(p_uid uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    (select ci.name from public.cosmetic_items ci where ci.id = p.look_title),
    (select sk.name || ' Master' from public.skills sk where sk.id = public.mastery_title_skill(p.look_title)),
    (select q.title_reward from public.quests q where q.id = p.equipped_title_quest))
  from public.profiles p where p.id = p_uid
$$;

revoke execute on function public.active_boost(uuid), public.owns_cosmetic(uuid, text), public.shown_title(uuid)
  from public, anon, authenticated;

-- Everything the Locker shows (core lockerView).
create or replace function public.locker_for(p_uid uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'cosmetics', (select coalesce(jsonb_agg(item_id order by acquired_at, item_id), '[]') from public.user_cosmetics where user_id = p_uid),
    'boosts', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'minutes', b.minutes, 'source', b.source, 'started_at', b.started_at, 'ends_at', b.ends_at)
                                         order by b.created_at, b.id), '[]')
               from public.user_boosts b where b.user_id = p_uid),
    'active_boost', (select to_jsonb(a) - 'user_id' - 'created_at' from public.active_boost(p_uid) a where a.id is not null),
    'look', (select jsonb_build_object('ring', p.look_ring, 'name_style', p.look_name_style, 'title', p.look_title) from public.profiles p where p.id = p_uid),
    'chests', (select coalesce(jsonb_agg('chest:' || skill_id || ':' || chapter order by opened_at), '[]') from public.user_chests where user_id = p_uid))
$$;
revoke execute on function public.locker_for(uuid) from public, anon, authenticated;

create or replace function public.get_locker() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  return public.locker_for(v_uid);
end $$;

-- ── Open a chest ──
create or replace function public.open_chest(p_skill_id text, p_chapter int) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  s public.app_settings;
  w jsonb;
  v_kl int;
  v_bp int;
  v_total numeric := 0;
  v_at numeric;
  v_roll text := 'boost_15';
  r text;
  v_item text;
  v_reward jsonb;
  v_boost uuid;
  v_key text;
  i int;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  perform 1 from public.profiles where id = v_uid for update;
  if not found then raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_chapter is null or p_chapter < 1 or not exists (select 1 from public.skills where id = p_skill_id) then
    raise exception 'CHEST_NOT_FOUND';
  end if;
  if exists (select 1 from public.user_chests where user_id = v_uid and skill_id = p_skill_id and chapter = p_chapter) then
    raise exception 'CHEST_OPENED';
  end if;
  select * into s from public.app_settings;
  if coalesce((select highest_cleared from public.user_skill_progress where user_id = v_uid and skill_id = p_skill_id), 0)
     < (p_chapter - 1) * 10 + s.chest_level_in_chapter then
    raise exception 'CHEST_LOCKED';
  end if;

  -- The weights this learner rolls with (core chestWeights).
  w := s.chest_loot;
  v_kl := public.user_knowledge_level(v_uid);
  if public.has_unlimited(v_uid) or public.brainpower_lock(v_uid) > s.brainpower_max - s.chest_brainpower then
    w := w || jsonb_build_object('boost_15', (w ->> 'boost_15')::int + (w ->> 'brainpower')::int, 'brainpower', 0);
  end if;
  foreach r in array array['common', 'rare', 'epic', 'legendary'] loop
    if v_kl < public.cosmetic_tier_min_level(r) or not exists (
      select 1 from public.cosmetic_items ci where ci.tier = r
        and not exists (select 1 from public.user_cosmetics uc where uc.user_id = v_uid and uc.item_id = ci.id)) then
      w := w || jsonb_build_object('boost_15', (w ->> 'boost_15')::int + (w ->> r)::int, r, 0);
    end if;
  end loop;

  -- One roll, walking the table in core CHEST_ROLLS order.
  foreach r in array array['boost_15', 'boost_30', 'boost_60', 'brainpower', 'common', 'rare', 'epic', 'legendary'] loop
    v_total := v_total + greatest((w ->> r)::int, 0);
  end loop;
  v_at := random() * v_total;
  foreach r in array array['boost_15', 'boost_30', 'boost_60', 'brainpower', 'common', 'rare', 'epic', 'legendary'] loop
    continue when (w ->> r)::int <= 0;
    if v_at < (w ->> r)::int then v_roll := r; exit; end if;
    v_at := v_at - (w ->> r)::int;
  end loop;

  v_key := 'chest:' || p_skill_id || ':' || p_chapter;
  if v_roll in ('boost_15', 'boost_30', 'boost_60') then
    insert into public.user_boosts (user_id, minutes, source) values (v_uid, substr(v_roll, 7)::int, v_key) returning id into v_boost;
    v_reward := jsonb_build_object('kind', 'boost', 'minutes', substr(v_roll, 7)::int, 'boost_id', v_boost);
  elsif v_roll = 'brainpower' then
    for i in 1 .. s.chest_brainpower loop
      perform public.brainpower_grant(v_uid, v_key || ':' || i, 'chest');
    end loop;
    v_reward := jsonb_build_object('kind', 'brainpower', 'amount', s.chest_brainpower);
  else
    select ci.id into v_item from public.cosmetic_items ci
    where ci.tier = v_roll and not exists (select 1 from public.user_cosmetics uc where uc.user_id = v_uid and uc.item_id = ci.id)
    order by ci.id collate "C" offset floor(random() * (
      select count(*) from public.cosmetic_items ci2 where ci2.tier = v_roll
        and not exists (select 1 from public.user_cosmetics uc where uc.user_id = v_uid and uc.item_id = ci2.id)))::int
    limit 1;
    insert into public.user_cosmetics (user_id, item_id, source) values (v_uid, v_item, v_key);
    v_reward := jsonb_build_object('kind', 'cosmetic', 'item_id', v_item, 'tier', v_roll);
  end if;

  insert into public.user_chests (user_id, skill_id, chapter, reward) values (v_uid, p_skill_id, p_chapter, v_reward);
  return jsonb_build_object('reward', v_reward, 'locker', public.locker_for(v_uid), 'daily', public.daily_status_for(v_uid));
end $$;

-- ── Start a boost ──
create or replace function public.start_boost(p_boost_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  b public.user_boosts;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  perform 1 from public.profiles where id = v_uid for update;
  select * into b from public.user_boosts where id = p_boost_id and user_id = v_uid;
  if not found then raise exception 'BOOST_NOT_FOUND'; end if;
  if b.started_at is not null then raise exception 'BOOST_USED'; end if;
  if (public.active_boost(v_uid)).id is not null then raise exception 'BOOST_ACTIVE'; end if;
  update public.user_boosts set started_at = now(), ends_at = now() + make_interval(mins => b.minutes)
  where id = p_boost_id and user_id = v_uid;
  return public.locker_for(v_uid);
end $$;

-- ── Wear things ──
create or replace function public.set_look(p_ring text, p_name_style text, p_title text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if (p_ring is not null and not (exists (select 1 from public.cosmetic_items where id = p_ring and kind = 'ring') and public.owns_cosmetic(v_uid, p_ring)))
     or (p_name_style is not null and not (exists (select 1 from public.cosmetic_items where id = p_name_style and kind = 'name_style') and public.owns_cosmetic(v_uid, p_name_style)))
     or (p_title is not null and not ((public.mastery_title_skill(p_title) is not null
                                       or exists (select 1 from public.cosmetic_items where id = p_title and kind = 'title'))
                                      and public.owns_cosmetic(v_uid, p_title))) then
    raise exception 'NOT_OWNED';
  end if;
  update public.profiles set
    look_ring = p_ring,
    look_name_style = p_name_style,
    look_title = p_title,
    equipped_title_quest = case when p_title is not null then null else equipped_title_quest end
  where id = v_uid;
  return public.locker_for(v_uid);
end $$;

-- A quest title takes off a look title (one title shows).
create or replace function public.set_equipped(p_title_quest text, p_emblem_quest text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_title_quest is not null and not exists (select 1 from public.user_trophies where user_id = v_uid and quest_id = p_title_quest) then
    raise exception 'NOT_EARNED';
  end if;
  if p_emblem_quest is not null and not exists (select 1 from public.user_trophies where user_id = v_uid and quest_id = p_emblem_quest) then
    raise exception 'NOT_EARNED';
  end if;
  update public.profiles set
    equipped_title_quest = p_title_quest,
    equipped_emblem_quest = p_emblem_quest,
    look_title = case when p_title_quest is not null then null else look_title end
  where id = v_uid;
  return jsonb_build_object('title_quest_id', p_title_quest, 'emblem_quest_id', p_emblem_quest);
end $$;

do $$
declare f text;
begin
  foreach f in array array['get_locker()', 'open_chest(text, integer)', 'start_boost(uuid)', 'set_look(text, text, text)', 'set_equipped(text, text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ── Others see the look ──
create or replace function public.social_card(p_uid uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', p.id, 'username', p.username, 'avatar', p.avatar, 'knowledge_level', public.user_knowledge_level(p.id),
    'weekly_xp', public.weekly_xp(p.id, public.league_week_start(now())),
    'ring', p.look_ring, 'name_style', p.look_name_style, 'title', public.shown_title(p.id))
  from public.profiles p where p.id = p_uid
$$;
revoke execute on function public.social_card(uuid) from public, anon, authenticated;

-- ── A boost in complete_level ──
create or replace function public.complete_level(p_level_id text, p_revision int, p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  s public.app_settings;
  v_level public.levels;
  v_cleared int;
  v_daily jsonb;
  v_date date;
  v_total int;
  v_first int;
  v_band public.level_xp_curve;
  v_xp int;
  v_is_mastery boolean;
  v_reinforced jsonb;
  v_perfect_before int := 0;
  v_streak_percent int := 0;
  v_streak_bonus int := 0;
  v_boosted boolean;
  v_extra int;
  prior public.user_level_progress;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_idempotency_key is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = '22023'; end if;

  -- Serialize this user's completions so double taps can't race.
  perform 1 from public.profiles where id = v_uid for update;
  if not found then raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002'; end if;

  select * into s from public.app_settings;
  select * into v_level from public.levels where id = p_level_id;
  if not found or v_level.status <> 'published' then raise exception 'LEVEL_NOT_AVAILABLE'; end if;
  if not exists (select 1 from public.level_revisions where level_id = p_level_id and revision = p_revision) then
    raise exception 'REVISION_NOT_FOUND';
  end if;
  select count(*) into v_total from public.questions where level_id = p_level_id;

  -- Exactly once: a second completion (same or different key) awards nothing.
  select * into prior from public.user_level_progress where user_id = v_uid and level_id = p_level_id and completed_at is not null;
  if found then
    return public.progress_summary(v_uid, v_level.skill_id) || jsonb_build_object(
      'level_id', p_level_id, 'already_completed', true, 'xp_awarded', 0,
      'first_attempt_correct', prior.correct_count, 'total', prior.question_count,
      'outcome', (public.first_attempt_band(v_level.level_type, prior.correct_count, prior.question_count)).outcome,
      'reinforced_concept_ids', '[]'::jsonb);
  end if;

  insert into public.user_skill_progress (user_id, skill_id) values (v_uid, v_level.skill_id) on conflict do nothing;
  select highest_cleared into v_cleared from public.user_skill_progress
  where user_id = v_uid and skill_id = v_level.skill_id for update;
  if v_level.number <> v_cleared + 1 then raise exception 'LEVEL_LOCKED'; end if;

  v_daily := public.daily_status_for(v_uid);
  if (v_daily ->> 'daily_complete')::boolean then raise exception 'DAILY_LIMIT_REACHED'; end if;
  v_date := (v_daily ->> 'local_date')::date;

  -- A level isn't complete until every question has been answered correctly.
  if exists (
    select 1 from public.questions q
    left join public.user_question_attempts a on a.user_id = v_uid and a.question_id = q.id
    where q.level_id = p_level_id and not coalesce(a.resolved_correct, false)
  ) then
    raise exception 'UNRESOLVED_QUESTIONS';
  end if;

  select count(*) filter (where a.first_attempt_correct) into v_first
  from public.questions q join public.user_question_attempts a on a.user_id = v_uid and a.question_id = q.id
  where q.level_id = p_level_id;

  -- Concepts first seen in this level: tested ones start at 0, untested at 1 (due tomorrow).
  insert into public.user_concept_mastery (user_id, concept_id, strength)
  select v_uid, lc.concept_id,
         case when exists (select 1 from public.question_concepts qc join public.questions qq on qq.id = qc.question_id
                           where qq.level_id = p_level_id and qc.concept_id = lc.concept_id) then 0 else 1 end
  from public.level_concepts lc where lc.level_id = p_level_id
  on conflict do nothing;

  -- Mastery from FIRST attempts (in question order, like the core engine).
  declare
    q record;
  begin
    for q in
      select qc.concept_id, a.first_attempt_correct as ok
      from public.questions qq
      join public.user_question_attempts a on a.user_id = v_uid and a.question_id = qq.id
      join public.question_concepts qc on qc.question_id = qq.id
      where qq.level_id = p_level_id
      order by qq.id collate "C", qc.concept_id collate "C"
    loop
      update public.user_concept_mastery m set
        strength = case when q.ok then least(m.strength + 1, 5) else 0 end,
        correct_count = m.correct_count + q.ok::int,
        incorrect_count = m.incorrect_count + (not q.ok)::int
      where m.user_id = v_uid and m.concept_id = q.concept_id;
    end loop;
  end;

  update public.user_concept_mastery m set seen_count = m.seen_count + 1, last_seen_at = now()
  from public.level_concepts lc
  where lc.level_id = p_level_id and m.user_id = v_uid and m.concept_id = lc.concept_id;

  -- Review priority per concept: the worst result among this level's questions on it.
  with prio as (
    select lc.concept_id,
           coalesce(max(case when a.question_id is not null
                             then public.review_priority(a.first_attempt_correct, a.attempt_count) end), 0) as p
    from public.level_concepts lc
    left join public.question_concepts qc on qc.concept_id = lc.concept_id
    left join public.questions qq on qq.id = qc.question_id and qq.level_id = p_level_id
    left join public.user_question_attempts a on a.user_id = v_uid and a.question_id = qq.id
    where lc.level_id = p_level_id
    group by lc.concept_id
  )
  insert into public.review_queue (user_id, concept_id, due_at, priority)
  select v_uid, m.concept_id,
         case when prio.p >= 2 then now() else now() + public.review_interval(m.strength) end,
         prio.p
  from public.user_concept_mastery m join prio on prio.concept_id = m.concept_id
  where m.user_id = v_uid
  on conflict (user_id, concept_id) do update set
    due_at = excluded.due_at,
    priority = greatest(public.review_queue.priority, excluded.priority);

  select coalesce(jsonb_agg(distinct qc.concept_id), '[]'::jsonb) into v_reinforced
  from public.questions qq
  join public.user_question_attempts a on a.user_id = v_uid and a.question_id = qq.id and not a.first_attempt_correct
  join public.question_concepts qc on qc.question_id = qq.id
  where qq.level_id = p_level_id;

  -- XP ledger: one LEVEL_COMPLETE event from first-attempt accuracy; corrections add nothing.
  v_band := public.first_attempt_band(v_level.level_type, v_first, v_total);
  v_is_mastery := v_level.number % s.mastery_band_size = 0;
  -- The ★ is earned by resolving the level, whatever the first-attempt score. No separate bonus.
  v_xp := v_band.xp;
  -- Perfect streak: a perfect level straight after other perfect ones pays extra, in the same event.
  if v_first >= v_total then
    v_perfect_before := public.perfect_streak_before(v_uid);
    v_streak_percent := least(v_perfect_before * s.perfect_streak_step_percent, s.perfect_streak_max_percent);
    v_streak_bonus := (v_band.xp * v_streak_percent + 50) / 100;
  end if;
  -- A running XP boost lifts the extra to 2x, the streak included, never past the cap (core levelBonusPercent).
  v_boosted := (public.active_boost(v_uid)).id is not null;
  v_extra := case when v_boosted
                  then (v_band.xp * least(greatest(v_streak_percent, s.boost_percent), s.perfect_streak_max_percent) + 50) / 100
                  else v_streak_bonus end;
  v_xp := v_xp + v_extra;

  insert into public.xp_events (user_id, type, amount, skill_id, level_id, reason, idempotency_key) values
    (v_uid, 'LEVEL_COMPLETE', v_xp, v_level.skill_id, p_level_id,
     'first attempt ' || v_first || '/' || v_total || ' (' || v_band.outcome || ')'
       || case when v_streak_bonus > 0 then ', perfect streak +' || v_streak_percent || '%' else '' end
       || case when v_boosted then ', XP boost' else '' end,
     'level_complete:' || p_level_id);

  update public.user_skill_progress set
    highest_cleared = v_level.number,
    stars = v_level.number / s.mastery_band_size,
    total_xp = total_xp + v_xp,
    updated_at = now()
  where user_id = v_uid and skill_id = v_level.skill_id;

  insert into public.user_level_progress (user_id, level_id, completed_at, completed_revision, correct_count, question_count, idempotency_key, started_revision)
  values (v_uid, p_level_id, now(), p_revision, v_first, v_total, p_idempotency_key, p_revision)
  on conflict (user_id, level_id) do update set
    completed_at = excluded.completed_at,
    completed_revision = excluded.completed_revision,
    correct_count = excluded.correct_count,
    question_count = excluded.question_count,
    idempotency_key = excluded.idempotency_key;

  insert into public.daily_allowances (user_id, local_date, new_levels_used) values (v_uid, v_date, 1)
  on conflict (user_id, local_date) do update set new_levels_used = public.daily_allowances.new_levels_used + 1;

  return public.progress_summary(v_uid, v_level.skill_id) || jsonb_build_object(
    'level_id', p_level_id,
    'already_completed', false,
    'skill_level_before', v_cleared,
    'first_attempt_correct', v_first,
    'total', v_total,
    'outcome', v_band.outcome,
    'reinforced_concept_ids', v_reinforced,
    'xp_awarded', v_xp,
    'mastery_cleared', v_is_mastery,
    'perfect_streak', case when v_first >= v_total then v_perfect_before + 1 else 0 end,
    'perfect_streak_percent', v_streak_percent,
    'perfect_streak_bonus_xp', v_streak_bonus,
    'boosted', v_boosted,
    'boost_bonus_xp', v_extra - v_streak_bonus
  );
end $$;

-- ── Analytics ──
insert into public.analytics_event_names (name, description) values
  ('chest_opened', 'Opened a map chest: props.skill_id, props.chapter, props.reward (boost, brainpower or cosmetic)'),
  ('boost_started', 'Started an XP boost from the Locker: props.boost (boost_15, boost_30 or boost_60)'),
  ('cosmetic_equipped', 'Wore a ring, name style or title from the Locker: props.kind, props.item_id');
update public.analytics_event_names set prop_keys = array['skill_id', 'chapter', 'reward']::text[] where name = 'chest_opened';
update public.analytics_event_names set prop_keys = array['boost']::text[] where name = 'boost_started';
update public.analytics_event_names set prop_keys = array['kind', 'item_id']::text[] where name = 'cosmetic_equipped';
