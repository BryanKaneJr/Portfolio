const router = require('express').Router();
const authRequired = require('../middleware/authRequired');
const { query } = require('../db');

router.use(authRequired);

router.get('/', async (req, res) => {
    const { rows } = await query(
        `SELECT m.id, m.kind, m.created_at,
                u.id   AS other_id,
                u.name AS other_name,
                u.photos AS other_photos
           FROM matches m
           JOIN users u ON u.id = CASE WHEN m.user_a = $1 THEN m.user_b ELSE m.user_a END
          WHERE (m.user_a = $1 OR m.user_b = $1)
            AND m.unmatched = FALSE
            AND u.is_banned = FALSE
          ORDER BY m.created_at DESC`,
        [req.userId]
    );
    res.json(rows);
});

router.post('/:id/unmatch', async (req, res) => {
    await query(
        `UPDATE matches SET unmatched = TRUE
          WHERE id = $1 AND (user_a = $2 OR user_b = $2)`,
        [req.params.id, req.userId]
    );
    res.json({ ok: true });
});

module.exports = router;
