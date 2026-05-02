// Story visibility rules:
//   A viewer V can see a story by poster P iff at least one of:
//     1. V has right-swiped P (i.e. V "liked" P)
//     2. V and P have an active match (any kind)
//     3. V and P are friend-linked (and P has not opted out of friend visibility)
//   AND neither party has blocked the other AND P is not banned AND
//   the story is not expired or removed.
//
// The check is implemented as a single SQL predicate fragment so callers can
// inline it in their queries.

const VISIBLE_PREDICATE = `
    s.removed = FALSE
    AND s.expires_at > now()
    AND p.is_banned = FALSE
    AND p.id <> $viewer
    AND p.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = $viewer)
    AND p.id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = $viewer)
    AND (
        EXISTS (
            SELECT 1 FROM swipes
             WHERE swiper_id = $viewer AND target_id = p.id AND direction = 'like'
        )
        OR EXISTS (
            SELECT 1 FROM matches m
             WHERE m.unmatched = FALSE
               AND ((m.user_a = $viewer AND m.user_b = p.id)
                 OR (m.user_b = $viewer AND m.user_a = p.id))
        )
        OR (p.friend_optout = FALSE AND EXISTS (
            SELECT 1 FROM friend_links
             WHERE user_id = $viewer AND friend_id = p.id
        ))
    )
`;

// Replace $viewer with a numbered parameter for pg client.
const buildVisibility = (paramIndex) =>
    VISIBLE_PREDICATE.replace(/\$viewer/g, `$${paramIndex}`);

module.exports = { buildVisibility };
