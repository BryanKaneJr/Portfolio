// "More Than Friends" - the privacy-sensitive feature.
//
// Privacy contract:
//   * GET /eligible returns friends who have NOT opted out and are NOT banned.
//     We do NOT reveal whether they have liked us. The flag `you_liked` only
//     tells the requester their OWN action, never the other side's.
//   * Friend likes are stored in friend_likes. Until the OTHER user also likes
//     us, no one - not even an admin in this MVP UI - sees the like surface
//     to the liked party.
//   * Mutual likes upgrade to a 'friend' kind match via matching.tryCreateFriendMatch.
const router = require('express').Router();
const authRequired = require('../middleware/authRequired');
const { query } = require('../db');
const { tryCreateFriendMatch } = require('../services/matching');

router.use(authRequired);

router.get('/eligible', async (req, res) => {
    // Friends I'm linked to who are visible to friends, plus a private
    // `you_liked` boolean for my own state.
    const { rows } = await query(
        `SELECT DISTINCT u.id, u.name, u.age, u.photos,
                EXISTS (
                    SELECT 1 FROM friend_likes fl
                     WHERE fl.liker_id = $1 AND fl.liked_id = u.id
                ) AS you_liked
           FROM friend_links f
           JOIN users u ON u.id = f.friend_id
          WHERE f.user_id = $1
            AND u.is_banned = FALSE
            AND u.friend_optout = FALSE
            AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = $1)
            AND u.id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = $1)
          ORDER BY u.name`,
        [req.userId]
    );
    res.json(rows);
});

router.post('/like', async (req, res) => {
    const { friendId } = req.body;
    if (!friendId || friendId === req.userId) {
        return res.status(400).json({ error: 'bad_target' });
    }

    // Confirm the link actually exists and is allowed. This prevents
    // a liker from secretly liking arbitrary user IDs they aren't friends with.
    const { rows } = await query(
        `SELECT 1 FROM friend_links fl
           JOIN users u ON u.id = fl.friend_id
          WHERE fl.user_id = $1 AND fl.friend_id = $2
            AND u.friend_optout = FALSE AND u.is_banned = FALSE`,
        [req.userId, friendId]
    );
    if (!rows.length) return res.status(403).json({ error: 'not_a_friend' });

    await query(
        `INSERT INTO friend_likes (liker_id, liked_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [req.userId, friendId]
    );

    const result = await tryCreateFriendMatch(req.userId, friendId);
    res.json(result);
});

router.delete('/like/:friendId', async (req, res) => {
    // Undo a friend like. If a friend match already exists we leave it -
    // unmatching is done via /matches/:id/unmatch.
    await query(
        `DELETE FROM friend_likes WHERE liker_id = $1 AND liked_id = $2`,
        [req.userId, req.params.friendId]
    );
    res.json({ ok: true });
});

module.exports = router;
