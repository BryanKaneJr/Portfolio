-- Hearts in the feed, and Brainpower for Weekly Quests (owner, 2026-10-03).
--
-- 1. The feed's only reaction is now a heart ("cleaner, like every other
--    app"). Earlier Dr. Scroll reactions become hearts, so nobody's likes are
--    lost; react() is unchanged and now only accepts 'heart'.
-- 2. Weekly Quests earn Brainpower, once each (brainpower_awards):
--      quest_step:<quest>:<skill>   a requirement met ("3 new Astronomy levels")
--      quest:<quest>                the whole quest completed
--    on top of the quest's trophy (which already earns its own +1). Mirrors
--    core `questBrainpower` (brainpower.ts).

-- ── 1. Hearts ──
update public.feed_reactions set reaction = 'heart' where reaction <> 'heart';
alter table public.feed_reactions drop constraint feed_reactions_reaction_check;
alter table public.feed_reactions add constraint feed_reactions_reaction_check check (reaction = 'heart');

-- ── 2. Quest Brainpower ──
alter table public.brainpower_awards drop constraint brainpower_awards_kind_check;
alter table public.brainpower_awards add constraint brainpower_awards_kind_check
  check (kind in ('streak', 'trophy', 'chapter_review', 'perfect', 'quest_step', 'quest'));

-- Every requirement met in a quest that's counting, and every completed quest.
-- quest_view gives progress only while a quest counts (live, the active
-- Archive quest, or completed), so nothing is awarded for a quest not taken on.
create or replace function public.brainpower_sync_quests(p_uid uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  q public.quests;
  v jsonb;
  r jsonb;
begin
  for q in select * from public.quests where status = 'published' and starts_at <= now() order by starts_at, id loop
    v := public.quest_view(p_uid, q);
    for r in select * from jsonb_array_elements(v -> 'requirements') loop
      if (r ->> 'required')::int > 0 and (r ->> 'done')::int >= (r ->> 'required')::int then
        perform public.brainpower_grant(p_uid, 'quest_step:' || q.id || ':' || (r ->> 'skill_id'), 'quest_step');
      end if;
    end loop;
    if v ->> 'state' = 'completed' then
      perform public.brainpower_grant(p_uid, 'quest:' || q.id, 'quest');
    end if;
  end loop;
end $$;
revoke execute on function public.brainpower_sync_quests(uuid) from public, anon, authenticated;

-- Quest progress is counted from LEVEL_COMPLETE (and no-new-levels CHAPTER_REVIEW)
-- rows, so check the quests as each one lands. (complete_level spends Brainpower
-- before it writes the XP row, so the spend trigger would see one level too few.)
create or replace function public.tg_brainpower_xp() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.type = 'DELAYED_RECALL' then perform public.brainpower_sync_trophies(new.user_id); end if;
  if new.type in ('LEVEL_COMPLETE', 'CHAPTER_REVIEW') then perform public.brainpower_sync_quests(new.user_id); end if;
  return new;
end $$;

-- Completing a quest (complete_quest sets completed_at).
create or replace function public.tg_brainpower_quest() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.completed_at is not null and old.completed_at is null then
    perform public.brainpower_sync_quests(new.user_id);
  end if;
  return new;
end $$;
create trigger brainpower_quest after update of completed_at on public.user_quests
  for each row execute function public.tg_brainpower_quest();

revoke execute on function public.tg_brainpower_xp(), public.tg_brainpower_quest()
  from public, anon, authenticated;
