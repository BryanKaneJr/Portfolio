-- Choose For Me (World Map): log when a learner starts a level it picked, to
-- see whether the picks appeal. `picks` counts offers seen, including "Pick again".
insert into public.analytics_event_names (name, description) values
  ('choose_for_me_started', 'Started a level from Choose For Me: props.skill_id, props.kind (new | resume), props.picks (offers seen)');
update public.analytics_event_names set prop_keys = array['skill_id', 'kind', 'picks']::text[] where name = 'choose_for_me_started';
