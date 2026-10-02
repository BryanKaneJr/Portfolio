-- Sharing a trophy: which trophies learners choose to send (never where or to whom).
insert into public.analytics_event_names (name, description) values
  ('trophy_shared', 'Sent a trophy card from the share sheet (or copied its line on the web): props.trophy_id, props.kind');
update public.analytics_event_names set prop_keys = array['trophy_id', 'kind']::text[] where name = 'trophy_shared';
