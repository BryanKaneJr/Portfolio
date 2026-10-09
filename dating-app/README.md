# Dating App MVP

Tinder-style local dating app with Facebook / Instagram social login and a
private "More Than Friends" matcher. Runs end-to-end without a real Meta
app thanks to a dev-only login provider — see **Demo without Meta** below.

## Layout

```
dating-app/
  backend/         Node.js + Express API
    db/schema.sql  Postgres schema
    public/        Admin dashboard (served at /dashboard)
    src/           Routes, services, auth, middleware
    tests/         Jest unit + supertest integration
    Dockerfile
  mobile/          Expo React Native client
  docker-compose.yml
  .env.example
```

## Constraints honoured

- **Auth:** Facebook OAuth or Instagram OAuth only. No email, no phone, no
  password. Anything that isn't `/auth/facebook`, `/auth/instagram`, or
  (dev-only) `/auth/dev` cannot produce a session.
- **Friend likes are private:** an unmatched friend like is never exposed to
  anyone except the liker. Only mutual likes surface a "More Than Friends"
  match.
- **Approximate location:** raw lat/lng is rounded to ~1km cells before being
  stored. Distances shown to other users are bucketed (`<2km`, `<5km`, ...).
- **Meta API limits:** the friend importer only ingests IDs the platform
  actually returns (`/me/friends` for Facebook, none for Instagram Basic
  Display). The schema and dev provider model that gracefully.
- **18+:** age is computed from social-provided DOB; under-18 is rejected at
  login. Instagram accounts (which don't return DOB) are routed through
  Complete-Your-Profile before they can swipe.
- **Rate limits:** login endpoints throttled per IP (`express-rate-limit`).
- **Moderation:** all user-authored text runs through a moderation hook
  before being persisted (bios, captions, messages).

## Quick start (Docker)

```
git clone <this repo>
cd dating-app
docker compose up --build
```

That starts Postgres (with schema loaded) + the API on `:4000`.
`DEV_AUTH=1` is on by default in compose so the client can sign in with
any handle.

Then run the mobile client:

```
cd mobile
npm install
npx expo start
```

Point Expo at the LAN IP of your Docker host by editing `mobile/app.json`
`extra.apiUrl` (defaults to `http://localhost:4000`).

## Demo without Meta

`DEV_AUTH=1` enables `POST /auth/dev/callback`. In the mobile client a
**Dev login** button appears; typing any handle (e.g. `alice`) creates or
returns that user. To exercise **More Than Friends** without a real
Facebook graph, sign in with `alice+friend=bob` — the auth handler links
`alice` and `bob` as mutual friends in `friend_links`. Sign in as `bob`
next, and Alice appears in the friends tab.

## Setup (bare metal)

1. `cp .env.example backend/.env` and fill the keys you have.
2. `psql $DATABASE_URL -f backend/db/schema.sql`
3. `cd backend && npm install && npm start`
4. `cd mobile && npm install && npx expo start`

The backend boots without OAuth keys (Facebook / Instagram routes return
503 cleanly).

## Admin dashboard

Log in as any user, flip `is_admin = TRUE` for them in the DB, and copy
their JWT (the app stores it in AsyncStorage under `token`). Then visit
`http://localhost:4000/dashboard/`, paste the token, and you can browse
users, resolve reports, remove stories, and ban/unban.

## Tests

```
cd backend
npm test
```

26 tests: unit tests for `geo`, `matching`, `storyVisibility`, `moderation`,
`chatStream`; plus a supertest integration test that exercises the dev
auth callback and the auth-required boundary of `/profile/me`.

## End-to-end behaviour

1. User taps **Continue with Facebook** / **Instagram** (or **Dev login** in
   development).
2. The mobile client receives an OAuth code and POSTs it to
   `POST /auth/{provider}/callback`.
3. Backend exchanges the code with Meta (or synthesizes a dev identity),
   fetches the user profile + (FB only) friend list, upserts a `users` row
   plus `social_accounts` and `friend_links` rows, and returns a signed JWT
   along with `isNew`.
4. On first launch after login the client checks `/profile/me`. If the user
   has no photo or name they are routed into a mandatory
   **Complete Your Profile** step (the same `EditProfile` screen with
   `onboarding: true`) which uploads photos via presigned S3 URLs (or the
   local `/uploads` sink) and confirms 18+.
5. The client registers an Expo push token via `/auth/push-token`.
6. Swiping right writes a row in `swipes`. If the other side already
   right-swiped, a `matches` row is created and both users get a push.
7. Matched users can chat via `messages`. The chat client opens an SSE
   stream at `/chat/:matchId/stream` for real-time delivery; if streaming
   fails it falls back to 4s polling. Either side can unmatch, block, or
   report.
8. The **More Than Friends** tab lists the user's `friend_links` (only
   friends who haven't opted out). Liking a friend writes a private
   `friend_likes` row. If the friend already liked back, a friend-kind
   `matches` row is inserted and both are notified. Unmatched likes stay
   completely invisible to the other party.
9. Stories expire after 24h. A viewer sees a story only if they've liked
   the poster, matched the poster, or are a connected friend (and the
   poster hasn't set `friend_optout`). Visibility is enforced by the
   `storyVisibility` predicate at query time; nothing leaks via the feed.
10. Reports flow into `reports`. Admins can ban users and delete content
    from `/admin/*` or the built-in dashboard.
11. Premium is a single boolean (`users.is_premium`) gating **see who liked
    you**, **boost**, and unlimited likes. `/billing/dev/set-premium`
    toggles it in development; production would wire this to a Stripe
    webhook.

See `backend/src/services/` for the core logic referenced above.
