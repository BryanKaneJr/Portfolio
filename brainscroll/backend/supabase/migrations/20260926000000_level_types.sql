-- Level types: BrainScroll is a learning app, and testing scales with the moment.
--   regular     3 light questions (recall, understanding, connection)
--   checkpoint  every 10th level, 5 questions
--   milestone   level 50 (150, 250 …), 7 questions
--   mastery     level 100 (200, 300 …), the 10-question Mastery Challenge
-- The schedule mirrors levelTypeFor() in packages/core/src/progression.ts; the
-- per-type question/learning structure lives in LEARNING_STRUCTURE (constants.ts)
-- and is enforced by the content validator before import.

alter table public.levels add column level_type text generated always as (
  case
    when number % 100 = 0 then 'mastery'
    when number % 100 = 50 then 'milestone'
    when number % 10 = 0 then 'checkpoint'
    else 'regular'
  end
) stored;

comment on column public.levels.level_type is
  'regular | checkpoint | milestone | mastery — derived from number; mirrors levelTypeFor() in @brainscroll/core';
