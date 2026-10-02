-- Keep review history through content corrections (bug review, 2026-09-30).
--
-- A correction that removes a question deleted every review answer to it
-- (the cascade added in 20261004000000_security_hardening.sql, so imports
-- wouldn't fail). Those answers are also the learning days behind the
-- streak and its trophies, which are never supposed to be taken away. The
-- answer now stays, with its question cleared. A cleared question behaves
-- as a deleted one did: an open correction for it is dropped from the queue
-- and the concept's next review starts a fresh occurrence.
alter table public.user_review_attempts alter column question_id drop not null;
alter table public.user_review_attempts drop constraint user_review_attempts_question_id_fkey;
alter table public.user_review_attempts
  add constraint user_review_attempts_question_id_fkey foreign key (question_id) references public.questions (id) on delete set null;
