# Notifications

BrainScroll sends two kinds of notifications. Both need the OS permission the app asks for once, after the first level.

| | Reminders | Friends and leagues |
| --- | --- | --- |
| What | "Finish Chapter 7 of Astronomy!", reviews, the 11 pm streak note | Friend requests, new friends, someone passing you in your league, your league result, hearts on your moments |
| Who sends | The phone itself (scheduled locally, `app/src/reminders`) | The server, through Expo's push service |
| Rules | Core `reminders.ts` | `claim_social_pushes` (migration `20261028000000_social_push.sql`) |
| Copy | Core `reminders.ts` (copy test in core) | `backend/supabase/functions/_shared/push.ts` (copy test in `scripts/test/push.test.ts`) |
| Switch | Settings → Reminders | Settings → Friends and leagues (on by default; stored on the server) |

Both follow the same line: the app wants people to come back, but never as a jerk. No guilt, no threats, no fake deadlines.

## Friends and leagues: how it works

1. **Events queue a note.** Database triggers write to `notification_outbox`:
   - a friend request: the other person hears about it;
   - a new friendship: whoever didn't make it happen hears "you're friends now";
   - a new heart on a feed moment: the owner hears about it;
   - XP that passes a league mate: they hear about it, at most once a day, and only if they've earned XP that week;
   - a finished league week: everyone who played hears their place and any prize.
2. **A cron job calls the `send-push` function** every 5 minutes. It:
   - closes finished league weeks (`finalize_due_leagues`), so results go out on Monday;
   - claims what may go out now;
   - sends it to Expo;
   - forgets devices Expo says are gone;
   - clears notes older than a week.
3. **The sending rules** (`claim_social_pushes`):
   - only with the switch on and a registered device;
   - only between 9 am and 9 pm in the learner's own time zone (later events wait);
   - at most 4 a day;
   - one note per kind per batch ("@ana and 2 others reacted…");
   - anything that waited over a day is dropped (two days for a league result).
4. **The app** registers this device's Expo push token whenever a signed-in learner opens it (`PushSync`). It forgets the token on sign-out, and opens Social, the league or the friend's profile when a note is tapped.

Tokens and queued notes are deleted with the account (`account-deletion.test.sql`).

## Owner setup (once)

None of this is needed to develop or test; the app works without it and simply sends no social notifications.

1. **iPhone push.**
   - The app's `expo-notifications` plugin (in `app.json`) gives iOS builds the push entitlement, so a build made before it was added (2026-10-02) can't receive pushes: make a new one.
   - EAS sets up Apple push credentials for you on the first build: answer yes when `eas build` offers to generate a push key.
   - To check, run `eas credentials` and look at iOS → Push Notifications.
2. **Android push (Firebase).**
   - In the Firebase console (free), create a project, then add an Android app with package `app.brainscroll`.
   - Download `google-services.json`, and upload it to EAS as a **file** environment variable named `GOOGLE_SERVICES_JSON` (expo.dev → project → Environment variables). `app.config.ts` picks it up.
   - Then, in the Firebase console → Project settings → Service accounts, generate a private key. Upload it to Expo: `eas credentials` → Android → Push Notifications: FCM V1.
   - That key is a secret: upload it yourself, never paste it anywhere else.
3. **Deploy the function** (from `brainscroll/backend/`, the folder `supabase link` was run in): `npx supabase functions deploy send-push --no-verify-jwt`.
4. **Pick a cron secret** (any long random string) and set it in two places. Type it yourself; it never goes in the repo or in chat.
   - As a function secret: `npx supabase secrets set PUSH_CRON_SECRET=<your secret>`.
   - In the database vault, from the Supabase SQL editor: `select vault.create_secret('<your secret>', 'push_cron_secret');`.
5. **Schedule it.**
   - In the Supabase dashboard → Database → Extensions, enable **pg_cron** and **pg_net**.
   - Then run this in the SQL editor, with your project ref:

   ```sql
   select cron.schedule('brainscroll-send-push', '*/5 * * * *', $$
     select net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/send-push',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')),
       body := '{}'::jsonb)
   $$);
   ```

6. **Check it.**
   - With the app on a phone (signed in, notifications allowed), have a second account send it a friend request between 9 am and 9 pm.
   - A note should arrive within 5 minutes.
   - Supabase dashboard → Edge Functions → send-push → Logs shows each run (`messages`, `sent`).
