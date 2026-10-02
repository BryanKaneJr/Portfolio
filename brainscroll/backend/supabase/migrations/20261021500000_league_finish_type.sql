-- League prizes' ledger type, on its own: Postgres won't let a new enum value
-- be used in the transaction that adds it, and 20261022000000_social.sql uses
-- it (supabase db push runs each migration file in one transaction).
alter type public.xp_event_type add value if not exists 'LEAGUE_FINISH';
