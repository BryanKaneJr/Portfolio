-- In-app account deletion (App Store / Google Play requirement for apps that
-- let people create accounts). Deleting the auth user cascades through
-- profiles to every table holding that learner's data: progress, attempts,
-- review state, the XP ledger, allowances, entitlement rows, content reports
-- and analytics events. Nothing about the learner remains.
--
-- Store subscriptions (post-MVP) are managed by Apple/Google and are NOT
-- cancelled by this; the app tells the learner so before they confirm.

create or replace function public.delete_my_account() returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  delete from auth.users where id = v_user;
  return jsonb_build_object('deleted', true);
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
