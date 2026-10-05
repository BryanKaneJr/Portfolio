-- The perfect streak tops out at 2.0× instead of 1.5× (owner, 2026-10-05:
-- "cap the multiplier at 2.0x its cleaner"): +10% per perfect level in a row,
-- up to +100%. Mirrors XP.PERFECT_STREAK_MAX_PERCENT (core). A project that
-- had changed the cap on purpose keeps its own value.
alter table public.app_settings alter column perfect_streak_max_percent set default 100;
update public.app_settings set perfect_streak_max_percent = 100 where perfect_streak_max_percent = 50;
