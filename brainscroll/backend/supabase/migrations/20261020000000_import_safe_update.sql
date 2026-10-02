-- Hosted Supabase runs PostgREST requests with pg-safeupdate, which rejects
-- any UPDATE or DELETE without a WHERE clause ("UPDATE requires a WHERE
-- clause"). import_content recomputed every skill's max_published_level
-- with an unqualified UPDATE, so the importer failed on a real project
-- (local Postgres has no such guard). It now updates only the skills whose
-- levels this call imported, which is also all that can have changed.
-- scripts/test/sql-safe-update.test.ts keeps new functions from repeating it.

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
    (select max(number) from public.levels l where l.skill_id = s.id and l.status = 'published'), 0)
  where s.id in (select x ->> 'skillId' from jsonb_array_elements(coalesce(p -> 'levels', '[]')) x);

  return jsonb_build_object('levels', v_levels, 'new_revisions', v_new_revisions);
end $$;

revoke execute on function public.import_content(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.import_content(jsonb, boolean) to service_role;
