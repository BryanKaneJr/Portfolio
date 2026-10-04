# Moderation: usernames and learner reports

Usernames are the only thing learners write that other learners see. There are no messages, comments or photos (CURRENT_PRODUCT_DECISIONS §22). Moderation therefore comes down to two things:
- refusing offensive usernames when they're set;
- a queue for the reports learners send from a profile (Report: their username, cheating or something else, with an optional note of up to 500 characters). Nobody can report themselves.

## The username filter

### The usual approach

There's no single official database. Apps typically combine four things:

1. **A term list.** Public lists exist, for example:
   - "List of Dirty, Naughty, Obscene, and Otherwise Bad Words" (LDNOOBW, CC BY 4.0);
   - the word lists in npm packages like `obscenity` and `bad-words`.

   Most teams start from one and curate it for their audience.
2. **Normalisation**, so simple workarounds don't get through:
   - look-alike digits (`sh1t`);
   - repeated letters (`fuuuck`);
   - separators (`f_u_c_k`).
3. **An allowlist** for innocent words that contain a term. Matching substrings blindly blocks "grape", "therapist" and the town of Scunthorpe (the "Scunthorpe problem").
4. **Reports and a person.** No list is complete and people are inventive, so reporting plus someone who can reset a name is what actually closes the gap.

AI moderation services (OpenAI's moderation endpoint, Google's Perspective, Hive) are worth it for free text such as comments and bios. For 3-to-20-character usernames, a curated list plus reports is the standard, and it keeps every username on our own server.

Generated defaults also help: everyone starts with a safe name like `curious_otter_4821` from fixed word lists, so only people who change their name ever meet the filter.

### What BrainScroll does

`packages/core/src/usernameFilter.ts` and SQL `username_blocked` (migrations `20261026000000_username_filter.sql` and `20261103000000_social_qa_fixes.sql`) implement exactly the four parts above:

- **Reserved names** (`brainscroll`, `drscroll`, `doctorscroll`) are refused anywhere in the whole name, read with underscores dropped, look-alike digits as letters and i, l and 1 as one letter. So `dr_scroll`, `brain_scroll`, `brainscroii` and `dr_scro11` are all refused.
- **Phrases** that are innocent but contain a word term (`cum_laude`, `sex_ed`, `hoe_down`, `tit_for_tat`, `dick_grayson`) are cut out first, even when underscores split them.
- **Anywhere terms** (unambiguous profanity, sexual terms, slurs, hate and violence, and names posing as BrainScroll staff) are refused inside any part of the name. Innocent words that contain one are cut out first (`grape`, `therapist`, `scunthorpe`, `badminton`, `supportive`, `rapeseed`, `pussycat`).
- **Word terms** (`ass`, `dick`, `cock`, `cum`, `sex`, `tit`, ...) are refused only as a whole part, since they hide in ordinary words (`class`, `dickens`, `cocktail`, `cucumber`, `sussex`).
- **The name is read** in parts at underscores, with one-letter parts joined (`f_u_c_k`), look-alike digits as letters, and any letter of a term allowed to repeat.

The server is the authority (`set_username` raises `USERNAME_NOT_ALLOWED`). The app runs the same check in Edit profile for an instant answer, and in local play.

### Changing the list

- **Permanently:** edit the lists in `usernameFilter.ts` (reserved, anywhere, word, allowed and phrase) and add a migration that changes `public.username_terms` the same way, with `delete from public.username_terms where term in (...)` and `insert into public.username_terms (term, kind) values ...`. `scripts/test/username-terms.test.ts` (in `npm run check`) replays the migrations and fails until both match.
- **Right away on the live project:** insert into `username_terms` from the Supabase SQL editor, for example `insert into public.username_terms values ('newterm', 'anywhere');`. Then bring the code in line with a migration.
- **Existing usernames** that fail a newly added term appear in the admin's moderation queue ("Usernames that fail the filter").

## The moderation queue (Content Admin)

1. Run `npm run insights:pull` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set in the shell (type the key yourself; never paste it anywhere else). It now also pulls open learner reports and flagged usernames.
2. Run `npm run admin` in the same shell and open **Learner reports**. Most-reported learners come first.
3. Who reported someone is never shown.
4. For each report:
   - **A bad username:** use **Reset username**. It gives them a fresh generated name and closes the username reports about them. Their friends simply see the new name.
   - **Cheating or something else:** look into it, then mark it **Resolved**, **Triaged** or **Dismiss**.
   - There's no ban tool yet. If one is ever needed, it's a server change (a flag that keeps someone out of leagues and search), not something to do by hand.

Actions go straight to the live project through `admin_*` functions that only the service role can call.
