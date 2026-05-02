# Dating App MVP

Tinder-style local dating app with Facebook / Instagram social login and a private
"More Than Friends" matcher.

## Layout

```
dating-app/
  backend/         Node.js + Express API
    db/schema.sql  Postgres schema
    src/           Routes, services, auth, middleware
  mobile/          Expo React Native client
```

## Constraints honoured

- **Auth:** Facebook OAuth or Instagram OAuth only. No email, no phone, no
  password. Anything that isn't `/auth/facebook` or `/auth/instagram` cannot
  produce a session.
- **Friend likes are private:** an unmatched friend like is never exposed to
  anyone except the liker. Only mutual likes surface a "More Than Friends"
  match.
- **Approximate location:** raw lat/lng is rounded to ~1km cells before being
  stored or returned. Distance is bucketed.
- **Meta API limits:** the friend importer only ingests IDs the platform
  actually returns (`/me/friends` for Facebook, none for Instagram Basic
  Display). The schema models that gracefully.
- **18+:** age is computed from social-provided DOB; under-18 accounts are
  rejected at login.

## Setup

1. `cp .env.example backend/.env` and fill the keys you have.
2. `psql $DATABASE_URL -f backend/db/schema.sql`
3. `cd backend && npm install && npm start`
4. `cd mobile && npm install && npx expo start`

The backend will boot without OAuth keys (login attempts will 503 cleanly).
This makes local schema/route work possible before you have Meta credentials.

## End-to-end behaviour

1. User taps "Continue with Facebook" / "Continue with Instagram" in the app.
2. The mobile client receives an OAuth code, posts it to
   `POST /auth/facebook/callback` (or `/auth/instagram/callback`).
3. Backend exchanges the code with Meta, fetches the user profile + (FB only)
   friend list, upserts a `users` row plus `social_accounts` and `friend_links`
   rows, and returns a signed JWT.
4. The client stores the JWT and calls `GET /profile/me`. If incomplete the
   user lands on `EditProfile`; otherwise `Swipe`.
5. Swiping right writes a row in `swipes`. If the other side already
   right-swiped, a `matches` row is created and both users get a push.
6. Matched users can chat via `messages`. Either side can unmatch, block,
   or report.
7. The "More Than Friends" tab lists the user's `friend_links`. Liking a friend
   writes a private `friend_likes` row. If the friend already liked back, a
   `friend_matches` row is inserted and both are notified.
8. Stories expire after 24h. A viewer sees a story only if they've liked the
   poster, matched the poster, or are a connected friend. Visibility is
   enforced server-side at query time; nothing leaks via the feed.
9. Reports flow into `reports`. Admins (flagged via `users.is_admin`) can ban
   users and delete content from `/admin/*`.
10. Premium is a single boolean (`users.is_premium`) gating `see who liked
    you`, `boost`, and unlimited likes.

See `backend/src/services/` for the core logic referenced above.
