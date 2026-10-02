-- Stage 5 review loop + content import/publish.
--
-- get_review_queue / submit_review mirror packages/core/src/completion.ts
-- (buildReviewQueue / submitReview). import_content is the only way content
-- enters the database: the scripts/import-content.ts CLI validates content/
-- and calls it with the service role.

-- ─────────────────────────────────────────────────────────────────────────────
-- Review
-- ─────────────────────────────────────────────────────────────────────────────

-- Mirrors XP.DELAYED_RECALL in packages/core/src/constants.ts.
alter table public.app_settings add column xp_delayed_recall int not null default 5;

-- One approved question per due concept, from levels the learner has completed.
-- Questions rotate by seen_count; no question appears twice in one queue.
create or replace function public.get_review_queue(p_limit int default 10) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_items jsonb := '[]'::jsonb;
  v_used text[] := '{}';
  r record;
  v_n int;
  v_pick record;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;

  for r in
    select rq.concept_id, m.seen_count
    from public.review_queue rq
    join public.user_concept_mastery m on m.user_id = rq.user_id and m.concept_id = rq.concept_id
    where rq.user_id = v_uid and rq.due_at <= now()
    order by rq.due_at, rq.concept_id collate "C"
  loop
    exit when jsonb_array_length(v_items) >= p_limit;

    select count(*) into v_n
    from public.questions q
    join public.question_concepts qc on qc.question_id = q.id and qc.concept_id = r.concept_id
    join public.user_level_progress ulp on ulp.level_id = q.level_id and ulp.user_id = v_uid and ulp.completed_at is not null
    where not (q.id = any (v_used));
    continue when v_n = 0;

    select q.id, q.level_id, l.skill_id into v_pick
    from public.questions q
    join public.levels l on l.id = q.level_id
    join public.question_concepts qc on qc.question_id = q.id and qc.concept_id = r.concept_id
    join public.user_level_progress ulp on ulp.level_id = q.level_id and ulp.user_id = v_uid and ulp.completed_at is not null
    where not (q.id = any (v_used))
    order by q.id collate "C"
    offset (r.seen_count % v_n) limit 1;

    v_used := v_used || v_pick.id;
    v_items := v_items || jsonb_build_object(
      'concept_id', r.concept_id, 'question_id', v_pick.id, 'level_id', v_pick.level_id, 'skill_id', v_pick.skill_id);
  end loop;

  return v_items;
end $$;

-- Applies one review answer. Only concepts currently due are updated (so a
-- double submit is harmless), skill levels never change, and the daily
-- allowance is never touched. A correct answer ≥ 20 h after the concept was
-- last seen awards DELAYED_RECALL once per concept per review cycle.
create or replace function public.submit_review(p_question_id text, p_option_id text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_skill text;
  v_level text;
  v_correct boolean;
  v_xp int := 0;
  v_refreshed text[] := '{}';
  v_strength int;
  v_inserted int;
  v_award int := (select xp_delayed_recall from public.app_settings);
  m record;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  perform 1 from public.profiles where id = v_uid for update;

  select q.level_id, l.skill_id into v_level, v_skill
  from public.questions q join public.levels l on l.id = q.level_id
  where q.id = p_question_id
    and exists (select 1 from public.user_level_progress ulp
                where ulp.user_id = v_uid and ulp.level_id = q.level_id and ulp.completed_at is not null);
  if not found then raise exception 'QUESTION_NOT_AVAILABLE'; end if;

  select coalesce((select correct from public.answer_options where question_id = p_question_id and option_id = p_option_id), false)
    into v_correct;

  for m in
    select um.concept_id, um.strength, um.last_seen_at
    from public.question_concepts qc
    join public.user_concept_mastery um on um.user_id = v_uid and um.concept_id = qc.concept_id
    join public.review_queue rq on rq.user_id = v_uid and rq.concept_id = qc.concept_id
    where qc.question_id = p_question_id and rq.due_at <= now()
    order by qc.concept_id collate "C"
    for update of um, rq
  loop
    v_refreshed := v_refreshed || m.concept_id;

    if v_correct and now() - m.last_seen_at >= interval '20 hours' then
      insert into public.xp_events (user_id, type, amount, skill_id, level_id, concept_id, reason, idempotency_key)
      values (v_uid, 'DELAYED_RECALL', v_award, v_skill, v_level, m.concept_id, 'delayed recall',
              'delayed_recall:' || m.concept_id || ':' || m.last_seen_at::text)
      on conflict (user_id, idempotency_key) do nothing;
      get diagnostics v_inserted = row_count;
      v_xp := v_xp + v_award * v_inserted;
    end if;

    v_strength := case when v_correct then least(m.strength + 1, 5) else 0 end;
    update public.user_concept_mastery set
      strength = v_strength,
      seen_count = seen_count + 1,
      correct_count = correct_count + v_correct::int,
      incorrect_count = incorrect_count + (not v_correct)::int,
      last_seen_at = now()
    where user_id = v_uid and concept_id = m.concept_id;
    update public.review_queue set due_at = now() + public.review_interval(v_strength)
    where user_id = v_uid and concept_id = m.concept_id;
  end loop;

  if v_xp > 0 then
    update public.user_skill_progress set total_xp = total_xp + v_xp, updated_at = now()
    where user_id = v_uid and skill_id = v_skill;
  end if;

  return jsonb_build_object(
    'correct', v_correct,
    'xp_awarded', v_xp,
    'refreshed', to_jsonb(v_refreshed),
    'correct_option_id', (select option_id from public.answer_options where question_id = p_question_id and correct),
    'explanation', (select explanation from public.questions where id = p_question_id)
  );
end $$;

revoke execute on function public.get_review_queue(int) from public, anon;
revoke execute on function public.submit_review(text, text) from public, anon;
grant execute on function public.get_review_queue(int) to authenticated;
grant execute on function public.submit_review(text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Content import / publish (service role only)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- p: validated content as produced by scripts/import-content.ts
--    { subjects, skills, sources, assets, concepts, levels } (camelCase, as in content/)
-- p_publish_drafts: staging convenience; treat draft/in_review as published.
--
-- Publishing a level stores its JSON (minus status) as an immutable revision.
-- Re-importing the same revision with identical content is a no-op; changing
-- content without bumping `revision` raises REVISION_CONFLICT.

create or replace function public.effective_status(p_status text, p_publish_drafts boolean) returns public.content_status
language sql immutable as $$
  select (case when p_publish_drafts and p_status in ('draft', 'in_review') then 'published' else p_status end)::public.content_status
$$;

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
    (select max(number) from public.levels l where l.skill_id = s.id and l.status = 'published'), 0);

  return jsonb_build_object('levels', v_levels, 'new_revisions', v_new_revisions);
end $$;

revoke execute on function public.import_content(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.import_content(jsonb, boolean) to service_role;
