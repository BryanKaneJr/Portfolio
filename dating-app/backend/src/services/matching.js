// Core matching logic.
// Canonicalisation: a match row always has user_a < user_b. This makes
// "is there already a match?" a single equality query and prevents duplicates.
const { tx } = require('../db');
const push = require('./push');

const pair = (a, b) => (a < b ? [a, b] : [b, a]);

// Try to upgrade a single right-swipe into a match. Idempotent.
// Returns { matched: boolean, matchId?: string } so the route can tell the client.
const tryCreateSwipeMatch = async (swiperId, targetId) => {
    const [a, b] = pair(swiperId, targetId);

    return tx(async (client) => {
        // Did the target already like us? If yes -> mutual.
        const reverse = await client.query(
            `SELECT 1 FROM swipes
              WHERE swiper_id = $1 AND target_id = $2 AND direction = 'like'`,
            [targetId, swiperId]
        );
        if (!reverse.rows.length) return { matched: false };

        const existing = await client.query(
            `SELECT id FROM matches WHERE user_a = $1 AND user_b = $2 AND kind = 'swipe'`,
            [a, b]
        );
        if (existing.rows[0]) {
            return { matched: true, matchId: existing.rows[0].id };
        }
        const ins = await client.query(
            `INSERT INTO matches (user_a, user_b, kind) VALUES ($1, $2, 'swipe') RETURNING id`,
            [a, b]
        );
        const matchId = ins.rows[0].id;
        // Notify both sides outside the txn would be safer; for MVP we fire and forget.
        push.send(swiperId, { title: "It's a match!", body: 'You both liked each other.', data: { matchId } });
        push.send(targetId, { title: "It's a match!", body: 'You both liked each other.', data: { matchId } });
        return { matched: true, matchId };
    });
};

// Same shape but for "More Than Friends" likes. Distinct kind so the two
// systems don't merge - a user might pursue both paths with the same person.
const tryCreateFriendMatch = async (likerId, likedId) => {
    const [a, b] = pair(likerId, likedId);

    return tx(async (client) => {
        const reverse = await client.query(
            `SELECT 1 FROM friend_likes WHERE liker_id = $1 AND liked_id = $2`,
            [likedId, likerId]
        );
        if (!reverse.rows.length) return { matched: false };

        const existing = await client.query(
            `SELECT id FROM matches WHERE user_a = $1 AND user_b = $2 AND kind = 'friend'`,
            [a, b]
        );
        if (existing.rows[0]) return { matched: true, matchId: existing.rows[0].id };

        const ins = await client.query(
            `INSERT INTO matches (user_a, user_b, kind) VALUES ($1, $2, 'friend') RETURNING id`,
            [a, b]
        );
        const matchId = ins.rows[0].id;
        push.send(likerId, { title: 'More Than Friends!', body: 'A friend liked you back.', data: { matchId } });
        push.send(likedId, { title: 'More Than Friends!', body: 'A friend liked you back.', data: { matchId } });
        return { matched: true, matchId };
    });
};

module.exports = { pair, tryCreateSwipeMatch, tryCreateFriendMatch };
