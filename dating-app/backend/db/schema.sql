-- Dating App MVP schema. Designed to be re-runnable on a fresh DB.
-- Privacy notes:
--   * lat/lng are stored already rounded to a ~1km cell; we never persist raw GPS.
--   * friend_likes are private rows; only mutual likes surface a friend_match.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Users ----------
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    age             INT  NOT NULL CHECK (age >= 18),
    gender          TEXT,                       -- self-described
    bio             TEXT DEFAULT '',
    photos          TEXT[] DEFAULT '{}',        -- ordered URLs
    preferences     JSONB DEFAULT '{}'::jsonb,  -- {gender, min_age, max_age, max_km}
    lat_cell        DOUBLE PRECISION,           -- rounded
    lng_cell        DOUBLE PRECISION,           -- rounded
    discoverable    BOOLEAN DEFAULT TRUE,       -- shows up in swipe feed
    friend_optout   BOOLEAN DEFAULT FALSE,      -- opt out of being seen by friends
    is_premium      BOOLEAN DEFAULT FALSE,
    is_admin        BOOLEAN DEFAULT FALSE,
    is_banned       BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_geo_idx ON users (lat_cell, lng_cell)
    WHERE discoverable = TRUE AND is_banned = FALSE;

-- ---------- Social accounts (the only auth source) ----------
CREATE TABLE IF NOT EXISTS social_accounts (
    id           BIGSERIAL PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider     TEXT NOT NULL CHECK (provider IN ('facebook','instagram')),
    provider_id  TEXT NOT NULL,
    access_token TEXT,                        -- short-lived; we re-fetch friends on demand
    created_at   TIMESTAMPTZ DEFAULT now(),
    UNIQUE (provider, provider_id)
);
CREATE INDEX IF NOT EXISTS social_accounts_user_idx ON social_accounts (user_id);

-- ---------- Friend links from Meta APIs ----------
-- Only friends that *also* use this app + appear in Meta's response will land here.
CREATE TABLE IF NOT EXISTS friend_links (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider    TEXT NOT NULL CHECK (provider IN ('facebook','instagram')),
    created_at  TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, friend_id, provider),
    CHECK (user_id <> friend_id)
);

-- ---------- Swipes ----------
CREATE TABLE IF NOT EXISTS swipes (
    swiper_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    direction   TEXT NOT NULL CHECK (direction IN ('like','pass')),
    created_at  TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (swiper_id, target_id),
    CHECK (swiper_id <> target_id)
);
CREATE INDEX IF NOT EXISTS swipes_target_like_idx ON swipes (target_id) WHERE direction = 'like';

-- ---------- Matches (canonicalised: user_a < user_b) ----------
CREATE TABLE IF NOT EXISTS matches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL CHECK (kind IN ('swipe','friend')),
    unmatched   BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_a, user_b, kind),
    CHECK (user_a < user_b)
);

-- ---------- Messages ----------
CREATE TABLE IF NOT EXISTS messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sender_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_match_idx ON messages (match_id, created_at);

-- ---------- Friend likes (private) ----------
CREATE TABLE IF NOT EXISTS friend_likes (
    liker_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    liked_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (liker_id, liked_id),
    CHECK (liker_id <> liked_id)
);

-- ---------- Stories ----------
CREATE TABLE IF NOT EXISTS stories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_url   TEXT NOT NULL,
    caption     TEXT DEFAULT '',
    lat_cell    DOUBLE PRECISION,
    lng_cell    DOUBLE PRECISION,
    created_at  TIMESTAMPTZ DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    removed     BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS stories_active_idx ON stories (expires_at) WHERE removed = FALSE;

-- ---------- Blocks ----------
CREATE TABLE IF NOT EXISTS blocks (
    blocker_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);

-- ---------- Reports ----------
CREATE TABLE IF NOT EXISTS reports (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user   UUID REFERENCES users(id) ON DELETE CASCADE,
    target_story  UUID REFERENCES stories(id) ON DELETE CASCADE,
    reason        TEXT NOT NULL,
    resolved      BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- ---------- Push tokens ----------
CREATE TABLE IF NOT EXISTS push_tokens (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT NOT NULL,
    platform   TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, token)
);
