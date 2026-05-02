const router = require('express').Router();
const authRequired = require('../middleware/authRequired');
const { query } = require('../db');
const push = require('../services/push');

router.use(authRequired);

const ensureMember = async (matchId, userId) => {
    const { rows } = await query(
        `SELECT user_a, user_b, unmatched FROM matches WHERE id = $1`,
        [matchId]
    );
    const m = rows[0];
    if (!m) return null;
    if (m.unmatched) return null;
    if (m.user_a !== userId && m.user_b !== userId) return null;
    return m;
};

router.get('/:matchId/messages', async (req, res) => {
    const m = await ensureMember(req.params.matchId, req.userId);
    if (!m) return res.status(404).json({ error: 'no_match' });

    const { rows } = await query(
        `SELECT id, sender_id, body, created_at
           FROM messages
          WHERE match_id = $1
          ORDER BY created_at ASC LIMIT 200`,
        [req.params.matchId]
    );
    res.json(rows);
});

router.post('/:matchId/messages', async (req, res) => {
    const m = await ensureMember(req.params.matchId, req.userId);
    if (!m) return res.status(404).json({ error: 'no_match' });

    const body = (req.body.body || '').trim();
    if (!body) return res.status(400).json({ error: 'empty' });
    if (body.length > 2000) return res.status(400).json({ error: 'too_long' });

    const { rows } = await query(
        `INSERT INTO messages (match_id, sender_id, body)
         VALUES ($1, $2, $3)
         RETURNING id, sender_id, body, created_at`,
        [req.params.matchId, req.userId, body]
    );

    const otherId = m.user_a === req.userId ? m.user_b : m.user_a;
    push.send(otherId, {
        title: 'New message',
        body: body.slice(0, 80),
        data: { matchId: req.params.matchId },
    });

    res.json(rows[0]);
});

module.exports = router;
