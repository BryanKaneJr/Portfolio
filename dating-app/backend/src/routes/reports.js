const router = require('express').Router();
const authRequired = require('../middleware/authRequired');
const { query } = require('../db');

router.use(authRequired);

router.post('/', async (req, res) => {
    const { targetUserId, targetStoryId, reason } = req.body;
    if (!reason || (!targetUserId && !targetStoryId)) {
        return res.status(400).json({ error: 'missing_target_or_reason' });
    }
    await query(
        `INSERT INTO reports (reporter_id, target_user, target_story, reason)
         VALUES ($1, $2, $3, $4)`,
        [req.userId, targetUserId || null, targetStoryId || null, reason.slice(0, 500)]
    );
    res.json({ ok: true });
});

router.post('/block', async (req, res) => {
    const { userId } = req.body;
    if (!userId || userId === req.userId) {
        return res.status(400).json({ error: 'bad_target' });
    }
    await query(
        `INSERT INTO blocks (blocker_id, blocked_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [req.userId, userId]
    );
    // Also unmatch any existing matches between the two parties.
    await query(
        `UPDATE matches SET unmatched = TRUE
          WHERE (user_a = $1 AND user_b = $2) OR (user_a = $2 AND user_b = $1)`,
        [req.userId, userId]
    );
    res.json({ ok: true });
});

router.delete('/block/:userId', async (req, res) => {
    await query(
        'DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2',
        [req.userId, req.params.userId]
    );
    res.json({ ok: true });
});

module.exports = router;
