-- Match and order questions (owner, 2026-10-03): "match the city with the
-- country" and "put the planets in order", alongside multiple choice.
--
-- An answer still travels as one text (p_option_id): an option id for
-- multiple choice, or for match and order a JSON array of labels (match: the
-- right-hand label chosen for each left item, in order; order: the items in
-- the order chosen). Grading is by label, so two identical labels are
-- interchangeable. core answers.ts (gradeAnswer) mirrors grade_answer.
--
-- Wrong answers to match and order say which positions are wrong ('wrong'),
-- never what belongs there.

create table public.question_arrangements (
  question_id text primary key references public.questions (id) on delete cascade,
  kind text not null check (kind in ('match', 'order')),
  -- The labels a right answer lists, in order.
  expected jsonb not null check (jsonb_typeof(expected) = 'array' and jsonb_array_length(expected) between 3 and 6)
);
alter table public.question_arrangements enable row level security;
-- No policies: answer keys are read only by the grading functions.

create or replace function public.grade_answer(p_question_id text, p_answer text, out correct boolean, out rationale text, out wrong jsonb)
language plpgsql stable set search_path = public, pg_temp as $$
declare
  v_expected jsonb;
  v_given jsonb;
begin
  select a.expected into v_expected from public.question_arrangements a where a.question_id = p_question_id;
  if v_expected is null then
    select coalesce(o.correct, false), o.rationale into correct, rationale
    from (select 1) one
    left join public.answer_options o on o.question_id = p_question_id and o.option_id = p_answer;
    return;
  end if;

  begin
    v_given := p_answer::jsonb;
  exception when others then
    v_given := null;
  end;
  -- Not a rearrangement of the question's own labels: every position is wrong.
  if v_given is null or jsonb_typeof(v_given) <> 'array'
     or jsonb_array_length(v_given) <> jsonb_array_length(v_expected)
     or exists (select 1 from jsonb_array_elements(v_given) x where jsonb_typeof(x) <> 'string')
     or (select array_agg(x collate "C" order by x collate "C") from jsonb_array_elements_text(v_given) x)
        is distinct from (select array_agg(x collate "C" order by x collate "C") from jsonb_array_elements_text(v_expected) x) then
    correct := false;
    wrong := (select jsonb_agg(i - 1 order by i) from jsonb_array_elements(v_expected) with ordinality e(v, i));
    return;
  end if;

  select coalesce(jsonb_agg(e.i - 1 order by e.i) filter (where e.v <> g.v), '[]'::jsonb) into wrong
  from jsonb_array_elements_text(v_expected) with ordinality e(v, i)
  join jsonb_array_elements_text(v_given) with ordinality g(v, i) on g.i = e.i;
  correct := jsonb_array_length(wrong) = 0;
  if correct then wrong := null; end if;
end $$;
-- Only the answering functions grade: a client calling this directly could test answers unrecorded.
revoke execute on function public.grade_answer(text, text) from public, anon, authenticated;

-- What a learner's phone receives: no answers. Multiple choice loses `correct`
-- and rationales; match sends its two columns with the right-hand one jumbled;
-- order sends its items jumbled. Jumbled by a hash (stable per question) and
-- never left already solved. `shuffled` tells the app not to jumble again.
create or replace function public.learner_question(q jsonb) returns jsonb
language sql immutable set search_path = public, pg_temp as $$
  select case coalesce(q ->> 'kind', 'mcq')
    when 'match' then (
      with given as (select coalesce(jsonb_agg(p ->> 'right' order by i), '[]'::jsonb) a from jsonb_array_elements(q -> 'pairs') with ordinality x(p, i)),
           s as (select coalesce(jsonb_agg(p ->> 'right' order by md5((q ->> 'id') || (p ->> 'right')), p ->> 'right'), '[]'::jsonb) a from jsonb_array_elements(q -> 'pairs') p)
      select (q - 'explanation' - 'pairs') || jsonb_build_object(
        'lefts', (select jsonb_agg(p ->> 'left' order by i) from jsonb_array_elements(q -> 'pairs') with ordinality x(p, i)),
        'rights', case when s.a = given.a and (select count(distinct p ->> 'right') from jsonb_array_elements(q -> 'pairs') p) > 1
                    then (s.a - 0) || jsonb_build_array(s.a -> 0) else s.a end,
        'shuffled', true)
      from given, s)
    when 'order' then (
      with s as (select coalesce(jsonb_agg(t order by md5((q ->> 'id') || t), t), '[]'::jsonb) a from jsonb_array_elements_text(q -> 'items') t)
      select (q - 'explanation') || jsonb_build_object(
        'items', case when s.a = q -> 'items' and (select count(distinct t) from jsonb_array_elements_text(q -> 'items') t) > 1
                   then (s.a - 0) || jsonb_build_array(s.a -> 0) else s.a end,
        'shuffled', true)
      from s)
    else (q - 'explanation') || jsonb_build_object('options', coalesce((
      select jsonb_agg(o - 'correct' - 'rationale' order by oi)
      from jsonb_array_elements(q -> 'options') with ordinality as oo(o, oi)), '[]'::jsonb))
  end
$$;

create or replace function public.learner_bundle(b jsonb) returns jsonb
language sql immutable set search_path = public, pg_temp as $$
  select case when b ? 'questions' then
    jsonb_set(b, '{questions}', coalesce((
      select jsonb_agg(public.learner_question(q) order by qi)
      from jsonb_array_elements(b -> 'questions') with ordinality as qq(q, qi)), '[]'::jsonb))
  else b end
$$;

-- Content import: match and order store their answer key.
create or replace function public.import_content(p jsonb, p_publish_drafts boolean default false) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  l jsonb;
  q jsonb;
  v_status public.content_status;
  v_rev int;
  v_current int;
  v_existing jsonb;
  v_bundle jsonb;
  v_levels int := 0;
  v_new_revisions int := 0;
begin
  insert into public.subjects (id, name, sort_order, status)
  select x ->> 'id', x ->> 'name', (x ->> 'order')::int, public.effective_status(x ->> 'status', p_publish_drafts)
  from jsonb_array_elements(coalesce(p -> 'subjects', '[]')) x
  on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order, status = excluded.status;

  insert into public.skills (id, subject_id, name, description, sort_order, status)
  select x ->> 'id', x ->> 'subjectId', x ->> 'name', x ->> 'description', (x ->> 'order')::int,
         public.effective_status(x ->> 'status', p_publish_drafts)
  from jsonb_array_elements(coalesce(p -> 'skills', '[]')) x
  on conflict (id) do update set subject_id = excluded.subject_id, name = excluded.name,
    description = excluded.description, sort_order = excluded.sort_order, status = excluded.status;

  insert into public.sources (id, title, url, publisher, license, accessed_at, verified, notes)
  select x ->> 'id', x ->> 'title', x ->> 'url', x ->> 'publisher', (x ->> 'license')::public.content_license,
         (x ->> 'accessedAt')::date, (x ->> 'verified')::boolean, x ->> 'notes'
  from jsonb_array_elements(coalesce(p -> 'sources', '[]')) x
  on conflict (id) do update set title = excluded.title, url = excluded.url, publisher = excluded.publisher,
    license = excluded.license, accessed_at = excluded.accessed_at, verified = excluded.verified, notes = excluded.notes;

  insert into public.assets (id, type, file, alt_text, license, source_id, attribution, width, height)
  select x ->> 'id', x ->> 'type', x ->> 'file', x ->> 'altText', (x ->> 'license')::public.content_license,
         x ->> 'sourceId', x ->> 'attribution', (x ->> 'width')::int, (x ->> 'height')::int
  from jsonb_array_elements(coalesce(p -> 'assets', '[]')) x
  on conflict (id) do update set type = excluded.type, file = excluded.file, alt_text = excluded.alt_text,
    license = excluded.license, source_id = excluded.source_id, attribution = excluded.attribution,
    width = excluded.width, height = excluded.height;

  insert into public.concepts (id, title, description, difficulty, facts)
  select x ->> 'id', x ->> 'title', x ->> 'description', (x ->> 'difficulty')::numeric, x -> 'facts'
  from jsonb_array_elements(coalesce(p -> 'concepts', '[]')) x
  on conflict (id) do update set title = excluded.title, description = excluded.description,
    difficulty = excluded.difficulty, facts = excluded.facts;

  insert into public.source_links (source_id, object_type, object_id)
  select distinct s, 'concept', x ->> 'id'
  from jsonb_array_elements(coalesce(p -> 'concepts', '[]')) x,
       jsonb_array_elements(x -> 'facts') f,
       jsonb_array_elements_text(f -> 'sourceIds') s
  on conflict do nothing;

  for l in select * from jsonb_array_elements(coalesce(p -> 'levels', '[]')) order by value ->> 'id' collate "C" loop
    v_levels := v_levels + 1;
    v_status := public.effective_status(l ->> 'status', p_publish_drafts);
    v_rev := (l ->> 'revision')::int;

    if exists (select 1 from public.levels where id = l ->> 'id'
               and (skill_id <> l ->> 'skillId' or number <> (l ->> 'number')::int)) then
      raise exception 'LEVEL_IDENTITY_CHANGED' using detail = format('%s: skill/number cannot change; create a new level id', l ->> 'id');
    end if;

    insert into public.levels (id, skill_id, number, title, summary, status)
    values (l ->> 'id', l ->> 'skillId', (l ->> 'number')::int, l ->> 'title', l ->> 'summary', v_status)
    on conflict (id) do update set title = excluded.title, summary = excluded.summary, status = excluded.status;

    -- Normalized teaching data always reflects the latest imported content.
    delete from public.level_concepts where level_id = l ->> 'id';
    insert into public.level_concepts (level_id, concept_id, role, weight)
    select l ->> 'id', x ->> 'conceptId', (x ->> 'role')::public.level_concept_role, coalesce((x ->> 'weight')::numeric, 1)
    from jsonb_array_elements(l -> 'concepts') x;

    delete from public.questions
    where level_id = l ->> 'id'
      and id not in (select x ->> 'id' from jsonb_array_elements(l -> 'questions') x);

    for q in select * from jsonb_array_elements(l -> 'questions') loop
      insert into public.questions (id, level_id, prompt, explanation, difficulty)
      values (q ->> 'id', l ->> 'id', q ->> 'prompt', q ->> 'explanation', (q ->> 'difficulty')::numeric)
      on conflict (id) do update set level_id = excluded.level_id, prompt = excluded.prompt,
        explanation = excluded.explanation, difficulty = excluded.difficulty;

      delete from public.question_concepts where question_id = q ->> 'id';
      insert into public.question_concepts (question_id, concept_id)
      select q ->> 'id', c from jsonb_array_elements_text(q -> 'conceptIds') c;

      delete from public.answer_options where question_id = q ->> 'id';
      insert into public.answer_options (question_id, option_id, label, correct, rationale)
      select q ->> 'id', o ->> 'id', o ->> 'label', (o ->> 'correct')::boolean, o ->> 'rationale'
      from jsonb_array_elements(q -> 'options') o;

      -- Match and order keep their answer key here: the labels a right answer lists, in order.
      delete from public.question_arrangements where question_id = q ->> 'id';
      if q ->> 'kind' in ('match', 'order') then
        insert into public.question_arrangements (question_id, kind, expected)
        values (q ->> 'id', q ->> 'kind',
          case when q ->> 'kind' = 'match'
            then (select jsonb_agg(pr ->> 'right' order by i) from jsonb_array_elements(q -> 'pairs') with ordinality x(pr, i))
            else q -> 'items' end);
      end if;
    end loop;

    insert into public.source_links (source_id, object_type, object_id)
    select s, 'level', l ->> 'id' from jsonb_array_elements_text(l -> 'sourceIds') s
    on conflict do nothing;

    if v_status = 'published' then
      v_bundle := l - 'status';
      select current_revision into v_current from public.levels where id = l ->> 'id';
      if v_current is not null and v_rev < v_current then
        raise exception 'REVISION_REGRESSION' using detail = format('%s: r%s is older than current r%s', l ->> 'id', v_rev, v_current);
      end if;

      select bundle into v_existing from public.level_revisions where level_id = l ->> 'id' and revision = v_rev;
      if found then
        if v_existing <> v_bundle then
          raise exception 'REVISION_CONFLICT'
            using detail = format('%s@r%s is published with different content; bump "revision" to publish a change', l ->> 'id', v_rev);
        end if;
      else
        insert into public.level_revisions (level_id, revision, bundle) values (l ->> 'id', v_rev, v_bundle);
        v_new_revisions := v_new_revisions + 1;
      end if;
      update public.levels set current_revision = v_rev where id = l ->> 'id';
    end if;
  end loop;

  update public.skills s set max_published_level = coalesce(
    (select max(number) from public.levels l where l.skill_id = s.id and l.status = 'published'), 0)
  where s.id in (select x ->> 'skillId' from jsonb_array_elements(coalesce(p -> 'levels', '[]')) x);

  return jsonb_build_object('levels', v_levels, 'new_revisions', v_new_revisions);
end $$;

-- Wrong positions for a reply, only when there are some: multiple choice replies stay exactly as before.
create or replace function public.wrong_positions(p_correct boolean, p_wrong jsonb) returns jsonb
language sql immutable set search_path = public, pg_temp as $$
  select case when not p_correct and p_wrong is not null then jsonb_build_object('wrong', p_wrong) else '{}'::jsonb end
$$;

-- Grading: every answering function goes through grade_answer.
create or replace function public.answer_question(p_level_id text, p_question_id text, p_option_id text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_level public.levels;
  v_cleared int;
  v_correct boolean;
  v_rationale text;
  v_wrong jsonb;
  v_explanation text;
  a public.user_question_attempts;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;

  select * into v_level from public.levels where id = p_level_id;
  if not found or v_level.status <> 'published' then raise exception 'LEVEL_NOT_AVAILABLE'; end if;
  select explanation into v_explanation from public.questions where id = p_question_id and level_id = p_level_id;
  if not found then raise exception 'QUESTION_NOT_IN_LEVEL'; end if;

  select g.correct, g.rationale, g.wrong into v_correct, v_rationale, v_wrong
  from public.grade_answer(p_question_id, p_option_id) g;

  -- Replays: grade only, but note the check (a review of this question right
  -- after earns no XP: see submit_review).
  if exists (select 1 from public.user_level_progress where user_id = v_uid and level_id = p_level_id and completed_at is not null) then
    insert into public.user_question_checks (user_id, question_id) values (v_uid, p_question_id)
    on conflict (user_id, question_id) do update set checked_at = now();
    return jsonb_build_object('correct', v_correct, 'resolved', v_correct, 'first_attempt_correct', v_correct, 'attempt_count', 0,
      'rationale', case when v_correct then null else v_rationale end,
      'explanation', case when v_correct then v_explanation else null end) || public.wrong_positions(v_correct, v_wrong);
  end if;

  perform 1 from public.profiles where id = v_uid for update;
  select coalesce((select highest_cleared from public.user_skill_progress where user_id = v_uid and skill_id = v_level.skill_id), 0)
    into v_cleared;
  if v_level.number <> v_cleared + 1 then raise exception 'LEVEL_LOCKED'; end if;

  insert into public.user_question_attempts (user_id, question_id, level_id, first_option_id, first_attempt_correct, resolved_correct, resolved_at)
  values (v_uid, p_question_id, p_level_id, p_option_id, v_correct, v_correct, case when v_correct then now() end)
  on conflict (user_id, question_id) do update set
    -- The first attempt never changes. Later attempts count until resolved; then nothing changes.
    attempt_count = user_question_attempts.attempt_count + (not user_question_attempts.resolved_correct)::int,
    resolved_correct = user_question_attempts.resolved_correct or excluded.resolved_correct,
    resolved_at = coalesce(user_question_attempts.resolved_at, excluded.resolved_at)
  returning * into a;

  return jsonb_build_object(
    'correct', v_correct,
    'resolved', a.resolved_correct,
    'first_attempt_correct', a.first_attempt_correct,
    'attempt_count', a.attempt_count,
    'rationale', case when v_correct then null else v_rationale end,
    'explanation', case when v_correct then v_explanation else null end
  ) || public.wrong_positions(v_correct, v_wrong);
end $$;

create or replace function public.submit_review(p_concept_id text, p_question_id text, p_option_id text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_skill text;
  v_level text;
  v_correct boolean;
  v_rationale text;
  v_wrong jsonb;
  v_explanation text;
  v_award int := (select xp_review_first_attempt from public.app_settings);
  v_xp int := 0;
  v_strength int;
  v_inserted int;
  v_relearning boolean;
  v_checked boolean;
  a public.user_review_attempts;
  rq public.review_queue;
  m public.user_concept_mastery;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  perform 1 from public.profiles where id = v_uid for update;

  select q.level_id, l.skill_id, q.explanation into v_level, v_skill, v_explanation
  from public.questions q
  join public.levels l on l.id = q.level_id
  join public.question_concepts qc on qc.question_id = q.id and qc.concept_id = p_concept_id
  where q.id = p_question_id
    and exists (select 1 from public.user_level_progress ulp
                where ulp.user_id = v_uid and ulp.level_id = q.level_id and ulp.completed_at is not null);
  if not found then raise exception 'QUESTION_NOT_AVAILABLE'; end if;

  select g.correct, g.rationale, g.wrong into v_correct, v_rationale, v_wrong
  from public.grade_answer(p_question_id, p_option_id) g;

  -- Correcting an open occurrence: resolution only. No XP, no strength change.
  select * into a from public.user_review_attempts
  where user_id = v_uid and concept_id = p_concept_id
  order by first_attempted_at desc, occurrence desc limit 1 for update;
  if found and not a.resolved_correct and a.question_id = p_question_id then
    update public.user_review_attempts set
      attempt_count = attempt_count + 1,
      resolved_correct = v_correct,
      resolved_at = case when v_correct then now() end
    where user_id = v_uid and concept_id = p_concept_id and occurrence = a.occurrence
    returning * into a;
    if v_correct then
      update public.review_queue set priority = greatest(priority, public.review_priority(false, a.attempt_count))
      where user_id = v_uid and concept_id = p_concept_id;
    end if;
    return jsonb_build_object('correct', v_correct, 'resolved', v_correct, 'first_attempt_correct', false,
      'attempt_count', a.attempt_count, 'xp_awarded', 0, 'scheduled', true,
      'rationale', case when v_correct then null else v_rationale end,
      'explanation', case when v_correct then v_explanation else null end) || public.wrong_positions(v_correct, v_wrong);
  end if;

  select * into rq from public.review_queue
  where user_id = v_uid and concept_id = p_concept_id and due_at <= now() for update;
  select * into m from public.user_concept_mastery
  where user_id = v_uid and concept_id = p_concept_id for update;

  -- Not due and nothing open: graded practice. Nothing recorded, nothing awarded
  -- (the check is noted, like a replay).
  if rq.concept_id is null or m.concept_id is null then
    insert into public.user_question_checks (user_id, question_id) values (v_uid, p_question_id)
    on conflict (user_id, question_id) do update set checked_at = now();
    return jsonb_build_object('correct', v_correct, 'resolved', v_correct, 'first_attempt_correct', v_correct,
      'attempt_count', 0, 'xp_awarded', 0, 'scheduled', false,
      'rationale', case when v_correct then null else v_rationale end,
      'explanation', case when v_correct then v_explanation else null end) || public.wrong_positions(v_correct, v_wrong);
  end if;

  -- First attempt at this scheduled occurrence. XP rewards remembering after a
  -- gap, so none for the quick re-check after a missed review (relearning), or
  -- when this question was graded outside review since it came due.
  v_relearning := a.concept_id is not null and not a.first_attempt_correct;
  v_checked := exists (select 1 from public.user_question_checks
                       where user_id = v_uid and question_id = p_question_id and checked_at >= rq.due_at);
  insert into public.user_review_attempts (user_id, concept_id, occurrence, question_id, first_option_id, first_attempt_correct, resolved_correct, resolved_at)
  values (v_uid, p_concept_id, rq.due_at, p_question_id, p_option_id, v_correct, v_correct, case when v_correct then now() end);

  v_strength := case when v_correct then least(m.strength + 1, 5) else 0 end;
  update public.user_concept_mastery set
    strength = v_strength,
    seen_count = seen_count + 1,
    correct_count = correct_count + v_correct::int,
    incorrect_count = incorrect_count + (not v_correct)::int,
    last_seen_at = now()
  where user_id = v_uid and concept_id = p_concept_id;
  update public.review_queue set
    due_at = now() + public.review_interval(v_strength),
    priority = case when v_correct then 0 else greatest(priority, 1) end
  where user_id = v_uid and concept_id = p_concept_id;

  if v_correct and not v_relearning and not v_checked then
    insert into public.xp_events (user_id, type, amount, skill_id, level_id, concept_id, reason, idempotency_key)
    values (v_uid, 'DELAYED_RECALL', v_award, v_skill, v_level, p_concept_id, 'review: right on the first attempt',
            'review:' || p_concept_id || ':' || rq.due_at::text)
    on conflict (user_id, idempotency_key) do nothing;
    get diagnostics v_inserted = row_count;
    v_xp := v_award * v_inserted;
    if v_xp > 0 then
      update public.user_skill_progress set total_xp = total_xp + v_xp, updated_at = now()
      where user_id = v_uid and skill_id = v_skill;
    end if;
  end if;

  return jsonb_build_object('correct', v_correct, 'resolved', v_correct, 'first_attempt_correct', v_correct,
    'attempt_count', 1, 'xp_awarded', v_xp, 'scheduled', true,
    'rationale', case when v_correct then null else v_rationale end,
    'explanation', case when v_correct then v_explanation else null end) || public.wrong_positions(v_correct, v_wrong);
end $$;

create or replace function public.answer_chapter_review(p_review_id uuid, p_question_id text, p_option_id text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_correct boolean;
  v_rationale text;
  v_wrong jsonb;
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
  select g.correct, g.rationale, g.wrong into v_correct, v_rationale, v_wrong
  from public.grade_answer(p_question_id, p_option_id) g;

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
    'explanation', case when v_correct then v_explanation else null end) || public.wrong_positions(v_correct, v_wrong);
end $$;

create or replace function public.answer_final_round(p_quest_id text, p_question_id text, p_option_id text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_correct boolean;
  v_rationale text;
  v_wrong jsonb;
  v_explanation text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  perform 1 from public.user_quest_answers a
  join public.user_quests uq on uq.user_id = a.user_id and uq.quest_id = a.quest_id
  where a.user_id = v_uid and a.quest_id = p_quest_id and a.question_id = p_question_id and uq.completed_at is null
  for update of a;
  if not found then raise exception 'QUESTION_NOT_IN_FINAL_ROUND'; end if;

  select q.explanation into v_explanation from public.questions q where q.id = p_question_id;
  select g.correct, g.rationale, g.wrong into v_correct, v_rationale, v_wrong
  from public.grade_answer(p_question_id, p_option_id) g;

  update public.user_quest_answers set attempt_count = attempt_count + 1,
    resolved_at = coalesce(resolved_at, case when v_correct then now() end)
  where user_id = v_uid and quest_id = p_quest_id and question_id = p_question_id;
  return jsonb_build_object('correct', v_correct, 'resolved', v_correct,
    'rationale', case when v_correct then null else v_rationale end,
    'explanation', case when v_correct then v_explanation else null end) || public.wrong_positions(v_correct, v_wrong);
end $$;
