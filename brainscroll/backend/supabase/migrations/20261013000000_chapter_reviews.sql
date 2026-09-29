-- Chapter reviews (owner, 2026-09-29): go back over any chapter you've
-- cleared, whenever you like. Mirrored on-device by
-- packages/core/src/chapterReview.ts; keep chapterReview.test.ts in step with
-- backend/tests/chapter-reviews.test.sql.
--
-- One question per level of the chapter, rotating with each finished review
-- of it. Graded like a level: the first attempt is recorded once, a miss is
-- corrected with the source cards, and the review finishes when every
-- question is resolved. It pays app_settings.xp_chapter_review_max (15, the
-- least a regular level pays) scaled by the share right on the first try.
-- Repeatable: farming is allowed, the return is just small.
--
-- Nothing else moves: no concept strength, no review schedule, no daily
-- allowance, no streak. Each answer is noted in user_question_checks, so the
-- next scheduled review of that question pays no XP (as with a replay).
--
-- Quests: a finished review whose skill has no new levels left for the
-- learner is recorded with reason 'no_new_levels' and counts as its chapter's
-- last level toward a Weekly Quest (quest_counted_levels, below). A level
-- counts once.

alter type public.xp_event_type add value if not exists 'CHAPTER_REVIEW';

alter table public.app_settings add column xp_chapter_review_max int not null default 15;
comment on column public.app_settings.xp_chapter_review_max is
  'Most XP a chapter review pays: the least a regular level pays. Mirrors XP.CHAPTER_REVIEW_MAX (core).';

create table public.user_chapter_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  skill_id text not null references public.skills (id),
  chapter int not null check (chapter >= 1),
  question_ids text[] not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  xp_awarded int
);
create index user_chapter_reviews_by_chapter on public.user_chapter_reviews (user_id, skill_id, chapter);
-- One unfinished review per chapter: starting again resumes it.
create unique index user_chapter_reviews_one_open on public.user_chapter_reviews (user_id, skill_id, chapter) where completed_at is null;

create table public.user_chapter_review_answers (
  user_id uuid not null references public.profiles (id) on delete cascade,
  review_id uuid not null references public.user_chapter_reviews (id) on delete cascade,
  question_id text not null references public.questions (id) on delete cascade,
  first_attempt_correct boolean not null,
  attempt_count int not null default 1,
  resolved_at timestamptz,
  primary key (review_id, question_id)
);

alter table public.user_chapter_reviews enable row level security;
alter table public.user_chapter_review_answers enable row level security;
create policy "own chapter reviews" on public.user_chapter_reviews for select using (user_id = auth.uid());
create policy "own chapter review answers" on public.user_chapter_review_answers for select using (user_id = auth.uid());

-- A review as the app sees it: its questions and which are already answered right.
create or replace function public.chapter_review_view(r public.user_chapter_reviews) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('review_id', r.id, 'skill_id', r.skill_id, 'chapter', r.chapter,
    'question_ids', to_jsonb(r.question_ids),
    'resolved', coalesce((select jsonb_agg(a.question_id order by a.question_id) from public.user_chapter_review_answers a
                          where a.review_id = r.id and a.resolved_at is not null), '[]'::jsonb))
$$;
revoke execute on function public.chapter_review_view(public.user_chapter_reviews) from public, anon, authenticated;

-- Start a review of a cleared chapter, or resume the unfinished one for it.
-- Each published level gives one question: sorted by id, the next one along
-- for every review of this chapter already finished.
create or replace function public.start_chapter_review(p_skill_id text, p_chapter int) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_cleared int;
  v_done int;
  v_ids text[];
  r public.user_chapter_reviews;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  perform 1 from public.profiles where id = v_uid for update;
  select coalesce((select highest_cleared from public.user_skill_progress where user_id = v_uid and skill_id = p_skill_id), 0)
    into v_cleared;
  if p_chapter is null or p_chapter < 1 or v_cleared < p_chapter * 10 then raise exception 'CHAPTER_NOT_CLEARED'; end if;

  select * into r from public.user_chapter_reviews
  where user_id = v_uid and skill_id = p_skill_id and chapter = p_chapter and completed_at is null;
  if r.id is null then
    select count(*) into v_done from public.user_chapter_reviews
    where user_id = v_uid and skill_id = p_skill_id and chapter = p_chapter and completed_at is not null;
    select coalesce(array_agg(pick.id order by pick.number), '{}') into v_ids from (
      select l.number, q.id,
             row_number() over (partition by l.id order by q.id collate "C") - 1 as i,
             count(*) over (partition by l.id) as n
      from public.levels l
      join public.questions q on q.level_id = l.id
      where l.skill_id = p_skill_id and l.status = 'published'
        and l.number between (p_chapter - 1) * 10 + 1 and p_chapter * 10
    ) pick where pick.i = v_done % pick.n;
    insert into public.user_chapter_reviews (user_id, skill_id, chapter, question_ids)
    values (v_uid, p_skill_id, p_chapter, v_ids) returning * into r;
  end if;
  return public.chapter_review_view(r);
end $$;
revoke execute on function public.start_chapter_review(text, int) from public, anon;
grant execute on function public.start_chapter_review(text, int) to authenticated;

-- One attempt at a review question. The first attempt is recorded once; later
-- ones only resolve it. The check is noted (see user_question_checks).
create or replace function public.answer_chapter_review(p_review_id uuid, p_question_id text, p_option_id text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_correct boolean;
  v_rationale text;
  v_explanation text;
  r public.user_chapter_reviews;
  a public.user_chapter_review_answers;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select * into r from public.user_chapter_reviews where id = p_review_id and user_id = v_uid for update;
  if r.id is null or r.completed_at is not null or not (p_question_id = any (r.question_ids)) then
    raise exception 'QUESTION_NOT_IN_REVIEW';
  end if;

  select q.explanation into v_explanation from public.questions q where q.id = p_question_id;
  select coalesce(o.correct, false), o.rationale into v_correct, v_rationale
  from (select 1) one left join public.answer_options o on o.question_id = p_question_id and o.option_id = p_option_id;

  insert into public.user_chapter_review_answers (user_id, review_id, question_id, first_attempt_correct, resolved_at)
  values (v_uid, r.id, p_question_id, v_correct, case when v_correct then now() end)
  on conflict (review_id, question_id) do update set
    -- The first attempt never changes. Later attempts count until resolved; then nothing changes.
    attempt_count = user_chapter_review_answers.attempt_count + (user_chapter_review_answers.resolved_at is null)::int,
    resolved_at = coalesce(user_chapter_review_answers.resolved_at, excluded.resolved_at)
  returning * into a;

  insert into public.user_question_checks (user_id, question_id) values (v_uid, p_question_id)
  on conflict (user_id, question_id) do update set checked_at = now();

  return jsonb_build_object('correct', v_correct, 'resolved', a.resolved_at is not null,
    'first_attempt_correct', a.first_attempt_correct, 'attempt_count', a.attempt_count,
    'rationale', case when v_correct then null else v_rationale end,
    'explanation', case when v_correct then v_explanation else null end);
end $$;
revoke execute on function public.answer_chapter_review(uuid, text, text) from public, anon;
grant execute on function public.answer_chapter_review(uuid, text, text) to authenticated;

-- Finish once every question is resolved: XP from first attempts, once.
create or replace function public.complete_chapter_review(p_review_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_max int := (select xp_chapter_review_max from public.app_settings);
  v_total int;
  v_right int;
  v_xp int;
  v_credit boolean;
  v_inserted int;
  r public.user_chapter_reviews;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  perform 1 from public.profiles where id = v_uid for update;
  select * into r from public.user_chapter_reviews where id = p_review_id and user_id = v_uid for update;
  if r.id is null then raise exception 'REVIEW_NOT_FOUND'; end if;

  -- Only questions that still exist (a content correction can remove one).
  select count(*), count(*) filter (where a.first_attempt_correct)
  into v_total, v_right
  from unnest(r.question_ids) x(id)
  join public.questions q on q.id = x.id
  left join public.user_chapter_review_answers a on a.review_id = r.id and a.question_id = x.id;

  if r.completed_at is not null then
    return jsonb_build_object('review_id', r.id, 'skill_id', r.skill_id, 'chapter', r.chapter, 'xp_awarded', 0,
      'first_attempt_correct', v_right, 'total', v_total, 'already_completed', true,
      'quest_credit', exists (select 1 from public.xp_events where user_id = v_uid
                              and idempotency_key = 'chapter_review:' || r.id and reason = 'no_new_levels'));
  end if;
  if exists (select 1 from unnest(r.question_ids) x(id)
             join public.questions q on q.id = x.id
             left join public.user_chapter_review_answers a on a.review_id = r.id and a.question_id = x.id
             where a.resolved_at is null) then
    raise exception 'REVIEW_UNRESOLVED';
  end if;

  v_xp := case when v_total > 0 then round(v_max * v_right::numeric / v_total)::int else 0 end;
  -- Nothing new left in this skill for the learner: the review counts toward quests.
  v_credit := coalesce((select highest_cleared from public.user_skill_progress where user_id = v_uid and skill_id = r.skill_id), 0)
              >= coalesce((select max(number) from public.levels where skill_id = r.skill_id and status = 'published'), 0);
  update public.user_chapter_reviews set completed_at = now(), xp_awarded = v_xp where id = r.id;
  insert into public.xp_events (user_id, type, amount, skill_id, level_id, reason, idempotency_key)
  values (v_uid, 'CHAPTER_REVIEW', v_xp, r.skill_id,
          (select id from public.levels where skill_id = r.skill_id and number = r.chapter * 10),
          case when v_credit then 'no_new_levels' else 'chapter_review' end, 'chapter_review:' || r.id)
  on conflict (user_id, idempotency_key) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted > 0 and v_xp > 0 then
    update public.user_skill_progress set total_xp = total_xp + v_xp, updated_at = now()
    where user_id = v_uid and skill_id = r.skill_id;
  end if;
  return jsonb_build_object('review_id', r.id, 'skill_id', r.skill_id, 'chapter', r.chapter, 'xp_awarded', v_xp * v_inserted,
    'first_attempt_correct', v_right, 'total', v_total, 'already_completed', false, 'quest_credit', v_credit);
end $$;
revoke execute on function public.complete_chapter_review(uuid) from public, anon;
grant execute on function public.complete_chapter_review(uuid) to authenticated;

-- Quests: first clears, plus chapter reviews with quest credit (each as its
-- chapter's last level). Per requirement, the first N distinct levels of
-- that skill inside the window, oldest first.
create or replace function public.quest_counted_levels(p_uid uuid, p_quest text, p_started timestamptz, p_resumed timestamptz)
returns table (skill_id text, level_id text, created_at timestamptz, sort_order int)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.skill_id, c.level_id, c.created_at, c.sort_order from (
    select d.skill_id, d.level_id, d.created_at, d.sort_order, d.new_levels,
           row_number() over (partition by d.skill_id order by d.created_at, d.id) as n
    from (
      select distinct on (e.level_id) e.skill_id, e.level_id, e.created_at, e.id, r.sort_order, r.new_levels
      from public.quest_requirements r
      join public.quests q on q.id = r.quest_id
      join public.xp_events e on e.user_id = p_uid and e.skill_id = r.skill_id
        -- ::text: the enum value is new in this migration.
        and (e.type = 'LEVEL_COMPLETE' or (e.type::text = 'CHAPTER_REVIEW' and e.reason = 'no_new_levels'))
      where r.quest_id = p_quest
        and ((e.created_at >= p_started and e.created_at < q.ends_at) or (p_resumed is not null and e.created_at >= p_resumed))
      order by e.level_id, e.created_at, e.id
    ) d
  ) c where c.n <= c.new_levels
$$;
revoke execute on function public.quest_counted_levels(uuid, text, timestamptz, timestamptz) from public, anon, authenticated;

-- Analytics: which chapters people go back to, and whether it fed a quest. Counts only.
insert into public.analytics_event_names (name, description) values
  ('chapter_review_started', 'Started (or resumed) a chapter review: props.skill_id, props.chapter'),
  ('chapter_review_completed', 'Finished a chapter review: props.skill_id, props.chapter, props.quest_credit (counted toward quests)');
update public.analytics_event_names set prop_keys = array['skill_id', 'chapter']::text[] where name = 'chapter_review_started';
update public.analytics_event_names set prop_keys = array['skill_id', 'chapter', 'quest_credit']::text[] where name = 'chapter_review_completed';
