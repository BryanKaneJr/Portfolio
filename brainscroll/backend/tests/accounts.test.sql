-- Accounts are required: the database never keeps an anonymous (guest) user.
\set ON_ERROR_STOP on
\set QUIET on
\ir fixtures.sql
\o /dev/null

create function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'expected error % but statement succeeded: %', code, sql;
exception when others then
  if sqlerrm not like '%' || code || '%' then raise exception 'expected error % but got: %', code, sqlerrm; end if;
end $$;

-- 1. An anonymous sign-up is refused outright: no user row, no profile.
select pg_temp.expect_error(
  $$insert into auth.users (id, is_anonymous) values ('00000000-0000-0000-0000-0000000000f1', true)$$,
  'ANONYMOUS_ACCOUNTS_NOT_SUPPORTED');
do $$ begin
  assert not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000000f1'), 'no anonymous user row';
  assert not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000f1'), 'no anonymous profile';
end $$;

-- 2. Every supported sign-in method creates a normal account with a profile.
insert into auth.users (id, email, phone, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'apple-relay@privaterelay.appleid.com', null, '{"provider": "apple"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'learner@gmail.com', null, '{"provider": "google"}'),
  ('00000000-0000-0000-0000-0000000000e3', null, '15551234567', '{"provider": "phone"}'),
  ('00000000-0000-0000-0000-0000000000e4', 'learner@example.org', null, '{"provider": "email"}');
do $$ begin
  assert (select count(*) from public.profiles where id in (
    '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2',
    '00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000e4')) = 4, 'each account gets a profile';
  assert not exists (select 1 from auth.users where is_anonymous), 'no anonymous users anywhere';
end $$;

-- 3. The guest-era analytics events are gone; the sign-in funnel replaces them.
do $$ begin
  assert not exists (select 1 from public.analytics_event_names where name in ('account_link_started', 'account_linked')), 'guest funnel removed';
  assert (select count(*) from public.analytics_event_names where name in ('sign_in_started', 'sign_in_completed')) = 2, 'sign-in funnel allowed';
end $$;

-- 4. A signed-in learner can log the sign-in funnel; nobody can log it signed out.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e3';
set role authenticated;
select public.log_events('[{"name": "sign_in_completed", "props": {"method": "phone"}}]');
reset role;
set role anon;
select pg_temp.expect_error($$select public.log_events('[{"name": "sign_in_started", "props": {"method": "email"}}]')$$, 'permission denied');
reset role;
do $$ begin
  assert (select count(*) from public.analytics_events where name = 'sign_in_completed' and props ->> 'method' = 'phone') = 1, 'sign-in logged';
end $$;

\echo accounts: all assertions passed
