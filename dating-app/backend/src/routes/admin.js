const router = require('express').Router();
const authRequired = require('../middleware/authRequired');
const adminRequired = require('../middleware/adminRequired');
const { query } = require('../db');

router.use(authRequired, adminRequired);

router.get('/users', async (req, res) => {
    const q = (req.query.q || '').toString();
    const { rows } = await query(
        `SELECT id, name, age, is_premium, is_banned, created_at
           FROM users
          WHERE ($1 = '' OR name ILIKE '%' || $1 || '%')
          ORDER BY created_at DESC LIMIT 100`,
        [q]
    );
    res.json(rows);
});

router.post('/users/:id/ban', async (req, res) => {
    await query('UPDATE users SET is_banned = TRUE WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
});

router.post('/users/:id/unban', async (req, res) => {
    await query('UPDATE users SET is_banned = FALSE WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
});

router.get('/reports', async (_req, res) => {
    const { rows } = await query(
        `SELECT r.*, u.name AS reporter_name
           FROM reports r JOIN users u ON u.id = r.reporter_id
          WHERE r.resolved = FALSE
          ORDER BY r.created_at DESC LIMIT 100`
    );
    res.json(rows);
});

router.post('/reports/:id/resolve', async (req, res) => {
    await query('UPDATE reports SET resolved = TRUE WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
});

router.delete('/stories/:id', async (req, res) => {
    await query('UPDATE stories SET removed = TRUE WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
});

module.exports = router;
