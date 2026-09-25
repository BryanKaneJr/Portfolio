-- Deeper lessons (2026-09-25) mention ideas that a later level teaches in full.
-- A level lists those concepts with the role 'preview'. Roles don't drive review
-- scheduling (review is question-based), so this only widens what import accepts.
alter type public.level_concept_role add value if not exists 'preview';
