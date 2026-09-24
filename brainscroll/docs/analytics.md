# Analytics and content reporting

**Measure learning and product health, never time spent.** BrainScroll exists to replace doomscrolling, so it doesn't optimise for minutes. There are no session-length, time-in-app, scroll-depth or "engagement minutes" metrics anywhere. A unit test fails if a duration-like event or prop is added to the catalog, and the health report has no time fields.

Everything is built and tested locally. Turning it on for real is configuration only: connect Supabase (`docs/supabase-setup.md`), then run `npm run insights:pull`.

## Where the numbers come from

Most signals are records the server already keeps for gameplay, so they're exact and can't be spoofed by a client:

| Question | Source |
|---|---|
| Is a question clear? Which distractor tempts people? | `user_question_attempts`: the immutable first attempt, including the **first option picked** |
| Do learners remember it later? (delayed recall) | `user_review_attempts`: first attempt per scheduled review occurrence |
| Do people finish levels? | `user_level_progress`: started/completed, first-try share |
| Are learners coming back? | days with any learning (`xp_events`, attempts). **Return days, not minutes.** |
| How often is the daily cap reached? | `daily_allowances` |
| Are players saving their progress? | `auth.users.is_anonymous` |

The client sends only what the server can't see, as a small allowlisted event set (`packages/core/src/analytics.ts`, mirrored by `public.analytics_event_names`; a test keeps them in sync):

| Event | Props | Why |
|---|---|---|
| `app_open` | `backend` | Return days |
| `onboarding_step` | `step` | Onboarding funnel |
| `level_exit` | `level_id`, `card_index`, `card_count` | Which card loses people in an unfinished level |
| `daily_complete_seen` | `used`, `cap` | How often learners reach the cap |
| `account_link_started` / `account_linked` | none | Save-progress funnel |
| `report_opened` | `object_type` | Report form usage |

**Privacy rules, enforced twice.** The client (`sanitizeEvent`) keeps only declared, typed, flat props, caps strings, and drops anything that looks like an email. The server (`log_events`) rejects unknown names, nested props and oversized props, and caps a learner at 50 events per call and 500 per day. Learners can't read the events table. Events are tied to the auth user id only, never an email. Offline builds send nothing. `EXPO_PUBLIC_ANALYTICS=off` disables tracking in any build. The queue persists on-device, so a reload doesn't lose events.

## Content reports

A **⚑ Report a problem** button in the level player reports the card or question on screen. The categories are: wrong, confusing, typo, media, other. There's an optional note of up to 1000 characters.

`report_content()` checks that the object belongs to that level revision. A repeat report on the same object updates the learner's open report instead of adding another, and each learner can file at most 20 reports a day. Direct inserts are blocked by RLS. Offline builds keep reports on-device. Reports never affect progress.

## Insights for the content team

```bash
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run insights:pull [-- --skill skill.science.astronomy --days 28]
npm run admin     # → Learner health, and a Learners tab per level
```

The pull calls service-role-only functions (`admin_learning_health`, `admin_question_stats`, `admin_level_funnel`, `admin_content_reports`) and writes `admin/.data/insights.json`, which is gitignored: it's aggregate but derived from real learners. Content Admin then shows:

- **Learner health:** active learners, learning days, levels completed, first-try rate, **delayed-recall rate**, the concept-strength distribution, the share of learning days that hit the cap, next-day and 7-day return, the saved-account share, and open reports. There's also a list of levels needing attention.
- **Per level (Learners tab):** started/completed, where people leave, and per question the first-try rate, average attempts, review recall, how often each option was picked first, and open reports.
- **Plain-language flags,** only once at least 20 learners have seen something:
  - under 35% right first time
  - over 97% right first time
  - a distractor chosen more often than the answer (misconception, or mis-keyed?)
  - a distractor never chosen
  - weak delayed recall
  - a level that over 20% of starters don't finish
  - exits concentrated on one card

`admin_set_report_status(id, status)` triages reports (`open → triaged → fixed | dismissed`). It isn't in the admin UI yet, because the admin is file-based and credential-free. Run it via the Supabase SQL editor or a script.

## Tested

- `backend/tests/analytics.test.sql`:
  - allowlist and nested-prop rejection
  - batch limits
  - RLS on events and reports
  - reports: object-in-level check, dedupe, limits
  - admin functions are service-role only
  - the question, funnel and health aggregates, and that health has no time fields
- `packages/core/test/analytics.test.ts`: sanitizing, no duration props.
- `scripts/test/analytics-sync.test.ts`: client catalog = server allowlist; categories = enum.
- `scripts/test/insights.test.ts`, `admin/test/insights.test.ts`, `admin/test/server.test.ts`: pull and flags.
- `e2e/remote.mjs`:
  - a report from the level player lands in `content_reports`
  - app_open, onboarding, level_exit and the account-link funnel are logged
  - no email reaches analytics

## Not built (on purpose, or later)

- No third-party analytics SDK. If one is added later (e.g. PostHog), it should sit behind `track()` and keep the same catalog and rules.
- No A/B testing, no push-notification metrics, no revenue analytics (subscriptions are out of scope).
- Retention of raw `analytics_events`: suggest deleting rows older than 13 months with a scheduled job. This needs a decision along with the privacy policy.
