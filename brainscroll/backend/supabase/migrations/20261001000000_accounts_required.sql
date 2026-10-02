-- Accounts are required. BrainScroll never creates anonymous (guest) users:
-- a learner signs in with Apple, Google, a phone number or email before any
-- progress exists, so there is no guest progress, no guest-to-account
-- migration, no merge and no guest cleanup job. See docs/accounts.md.

-- 1. The database refuses anonymous users, even if the project setting
--    "Allow anonymous sign-ins" is switched on by mistake. Raising here aborts
--    the sign-up, so no auth.users row and no profile is ever created.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(new.is_anonymous, false) then
    raise exception 'ANONYMOUS_ACCOUNTS_NOT_SUPPORTED' using errcode = '42501',
      hint = 'BrainScroll requires Sign in with Apple, Google, phone or email.';
  end if;
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

-- 2. No anonymous user records are kept. Any left from the old anonymous-first
--    design are removed; their data cascades through profiles.
delete from auth.users where is_anonymous;

-- 3. Analytics: the guest "save your progress" funnel becomes a sign-in funnel.
delete from public.analytics_events where name in ('account_link_started', 'account_linked');
delete from public.analytics_event_names where name in ('account_link_started', 'account_linked');
insert into public.analytics_event_names (name, description) values
  ('sign_in_started', 'A sign-in method was chosen or a code was requested: props.method'),
  ('sign_in_completed', 'Signed in (new or returning account): props.method');

-- 4. Learning health: replace the guest-vs-saved share with sign-in methods.
create or replace function public.admin_learning_health(p_days int default 28) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with win as (select now() - make_interval(days => p_days) as since),
  activity as (  -- one row per learner per UTC day with any learning
    select user_id, (created_at at time zone 'UTC')::date as d from public.xp_events, win where created_at >= since
    union
    select user_id, (first_attempt_at at time zone 'UTC')::date from public.user_question_attempts, win where first_attempt_at >= since
    union
    select user_id, (first_attempted_at at time zone 'UTC')::date from public.user_review_attempts, win where first_attempted_at >= since
  ), firsts as (select user_id, min(d) as d0 from activity group by user_id),
  cap as (select daily_free_new_levels as n from public.app_settings)
  select jsonb_build_object(
    'window_days', p_days,
    'active_learners', (select count(distinct user_id) from activity),
    'learning_days', (select count(*) from activity),
    'levels_completed', (select count(*) from public.xp_events, win where type = 'LEVEL_COMPLETE' and created_at >= since),
    'first_try_rate_new_levels', (select avg(first_attempt_correct::int)::numeric(5, 3) from public.user_question_attempts, win where first_attempt_at >= since),
    -- Delayed recall: right on the first try at a scheduled review. The truest learning signal here.
    'review_first_try_rate', (select avg(first_attempt_correct::int)::numeric(5, 3) from public.user_review_attempts, win where first_attempted_at >= since),
    'reviews_answered', (select count(*) from public.user_review_attempts, win where first_attempted_at >= since),
    'concept_strength_distribution', (select coalesce(jsonb_object_agg(strength, n), '{}') from (select strength, count(*) as n from public.user_concept_mastery group by strength) s),
    'days_at_daily_cap_share', (select (count(*) filter (where new_levels_used >= (select n from cap))::numeric / nullif(count(*), 0))::numeric(5, 3)
                                 from public.daily_allowances, win where local_date >= since::date and new_levels_used > 0),
    'returned_next_day_share', (select (count(*) filter (where exists (select 1 from activity a where a.user_id = f.user_id and a.d = f.d0 + 1))::numeric / nullif(count(*), 0))::numeric(5, 3)
                                 from firsts f where f.d0 < current_date - 1),
    'returned_within_7_days_share', (select (count(*) filter (where exists (select 1 from activity a where a.user_id = f.user_id and a.d between f.d0 + 1 and f.d0 + 7))::numeric / nullif(count(*), 0))::numeric(5, 3)
                                 from firsts f where f.d0 < current_date - 7),
    -- How new learners choose to sign in (Apple, Google, phone, email). Every learner has an account.
    'new_accounts_by_method', (select coalesce(jsonb_object_agg(method, n), '{}') from (
                                 select coalesce(u.raw_app_meta_data ->> 'provider', 'unknown') as method, count(*) as n
                                 from auth.users u, win where u.created_at >= since group by 1) m),
    'open_reports', (select count(*) from public.content_reports where status = 'open')
  )
$$;
