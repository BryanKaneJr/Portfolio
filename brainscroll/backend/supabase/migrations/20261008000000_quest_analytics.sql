-- Weekly Quest analytics: which themes people open, start from the Archive,
-- reach the Final Round in, and finish (live or from the Archive). Counts only.
insert into public.analytics_event_names (name, description) values
  ('quest_viewed', 'Opened a Weekly Quest: props.quest_id, props.state (live | archive | completed)'),
  ('quest_started', 'Started a quest from the Archive: props.quest_id'),
  ('quest_final_round_started', 'Opened a quest''s Final Round: props.quest_id'),
  ('quest_completed', 'Finished a Weekly Quest: props.quest_id, props.live_clear (earned the trophy)');
update public.analytics_event_names set prop_keys = array['quest_id', 'state']::text[] where name = 'quest_viewed';
update public.analytics_event_names set prop_keys = array['quest_id']::text[] where name = 'quest_started';
update public.analytics_event_names set prop_keys = array['quest_id']::text[] where name = 'quest_final_round_started';
update public.analytics_event_names set prop_keys = array['quest_id', 'live_clear']::text[] where name = 'quest_completed';
