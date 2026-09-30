-- Chapter review integrity (security review, 2026-09-30).
--
-- 1. Replaying a cleared level grades an answer without recording it, so a
--    script could check each question just before answering it in a chapter
--    review and always score 15. A chapter-review first attempt now counts
--    as right only if that question wasn't checked outside the review since
--    the review started (user_question_checks, as submit_review does).
-- 2. A chapter whose levels have all been retired started an empty review
--    that completed at once with quest credit. Starting one now fails
--    (CHAPTER_NOT_AVAILABLE), and a review with nothing left to answer never
--    gives quest credit.
-- Mirrored in packages/core/src/chapterReview.ts.

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
    -- A chapter whose levels have all been retired has nothing to review.
    if cardinality(v_ids) = 0 then raise exception 'CHAPTER_NOT_AVAILABLE'; end if;
    insert into public.user_chapter_reviews (user_id, skill_id, chapter, question_ids)
    values (v_uid, p_skill_id, p_chapter, v_ids) returning * into r;
  end if;
  return public.chapter_review_view(r);
end $$;
revoke execute on function public.start_chapter_review(text, int) from public, anon;
grant execute on function public.start_chapter_review(text, int) to authenticated;

create or replace function public.answer_chapter_review(p_review_id uuid, p_question_id text, p_option_id text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_correct boolean;
  v_rationale text;
  v_explanation text;
  r public.user_chapter_reviews;
  a public.user_chapter_review_answers;
  v_prechecked boolean;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select * into r from public.user_chapter_reviews where id = p_review_id and user_id = v_uid for update;
  if r.id is null or r.completed_at is not null or not (p_question_id = any (r.question_ids)) then
    raise exception 'QUESTION_NOT_IN_REVIEW';
  end if;

  -- Checked outside this review since it started (a replay of the level grades
  -- without recording): the answer was just seen, so the first try can't count.
  v_prechecked := exists (select 1 from public.user_question_checks
                          where user_id = v_uid and question_id = p_question_id and checked_at >= r.started_at);
  select q.explanation into v_explanation from public.questions q where q.id = p_question_id;
  select coalesce(o.correct, false), o.rationale into v_correct, v_rationale
  from (select 1) one left join public.answer_options o on o.question_id = p_question_id and o.option_id = p_option_id;

  insert into public.user_chapter_review_answers (user_id, review_id, question_id, first_attempt_correct, resolved_at)
  values (v_uid, r.id, p_question_id, v_correct and not v_prechecked, case when v_correct then now() end)
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
              >= coalesce((select max(number) from public.levels where skill_id = r.skill_id and status = 'published'), 0)
              -- Nothing answered (every question removed since it started): no quest credit.
              and v_total > 0;
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
