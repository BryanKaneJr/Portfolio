-- Generated usernames pass the username filter too. Some 4-digit suffixes read
-- as blocked words once look-alike digits count as letters (8008, 7175), so
-- about 1 new learner in 450 was given a username the admin's queue then
-- flagged. The generator now skips those.
create or replace function public.generate_username() returns text
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  adj text[] := array['curious', 'bright', 'clever', 'swift', 'bold', 'calm', 'keen', 'wise', 'sunny', 'lucky', 'brave', 'witty'];
  noun text[] := array['owl', 'fox', 'otter', 'panda', 'falcon', 'koala', 'lynx', 'heron', 'badger', 'whale', 'comet', 'atlas'];
  v text;
begin
  loop
    v := adj[1 + floor(random() * array_length(adj, 1))::int] || '_' || noun[1 + floor(random() * array_length(noun, 1))::int] || '_' || lpad(floor(random() * 10000)::int::text, 4, '0');
    exit when not public.username_blocked(v) and not exists (select 1 from public.profiles where username = v);
  end loop;
  return v;
end $$;
