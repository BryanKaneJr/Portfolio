-- Hardening from Supabase's security advisor (staging, 2026-10-02).
--
-- 1. Nothing is callable without signing in. Every learner signs in first
--    (no guest mode), so anon never needs these:
--    - get_level_bundles was granted to anon before accounts were required;
--    - log_events and report_content already refuse a missing user, but don't
--      need to be reachable at all;
--    - the trigger functions only ever run as triggers.
revoke execute on function public.get_level_bundles(text[]) from public, anon;
grant execute on function public.get_level_bundles(text[]) to authenticated;
revoke execute on function public.log_events(jsonb) from public, anon;
grant execute on function public.log_events(jsonb) to authenticated;
revoke execute on function public.report_content(text, integer, text, text, public.report_category, text) from public, anon;
grant execute on function public.report_content(text, integer, text, text, public.report_category, text) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.tg_learning_day_level() from public, anon, authenticated;
revoke execute on function public.tg_learning_day_review() from public, anon, authenticated;
revoke execute on function public.forbid_mutation() from public, anon, authenticated;
revoke execute on function public.validate_profile_timezone() from public, anon, authenticated;

-- 2. Every helper resolves names in a fixed search path, so a caller's own
--    schema can never shadow a table or function they use.
alter function public.effective_status(text, boolean) set search_path = public, pg_temp;
alter function public.forbid_mutation() set search_path = public, pg_temp;
alter function public.knowledge_level(integer) set search_path = public, pg_temp;
alter function public.league_week_start(timestamptz) set search_path = public, pg_temp;
alter function public.learner_bundle(jsonb) set search_path = public, pg_temp;
alter function public.legendary_avatar_trophy(text) set search_path = public, pg_temp;
alter function public.review_interval(integer) set search_path = public, pg_temp;
alter function public.review_priority(boolean, integer) set search_path = public, pg_temp;
alter function public.streak_feed_milestones() set search_path = public, pg_temp;
alter function public.try_timestamptz(text) set search_path = public, pg_temp;
alter function public.try_uuid(text) set search_path = public, pg_temp;
alter function public.validate_profile_timezone() set search_path = public, pg_temp;
alter function public.week_start_at(date) set search_path = public, pg_temp;
