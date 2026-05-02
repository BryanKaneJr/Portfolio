// MVP billing surface. Real implementation would integrate Stripe / RevenueCat
// and verify a webhook before flipping is_premium. For prototype we expose a
// stubbed endpoint that toggles the flag so the rest of the app can be tested.
const router = require('express').Router();
const authRequired = require('../middleware/authRequired');
const { query } = require('../db');

router.use(authRequired);

router.get('/me', async (req, res) => {
    const { rows } = await query(
        'SELECT is_premium FROM users WHERE id = $1', [req.userId]
    );
    res.json({ premium: rows[0].is_premium });
});

// Stub: in production this should be called only by a verified webhook,
// not by the client. Guarded behind a header-based debug flag for MVP.
router.post('/dev/set-premium', async (req, res) => {
    if (req.headers['x-debug-billing'] !== '1') {
        return res.status(403).json({ error: 'forbidden' });
    }
    const value = !!req.body.premium;
    await query('UPDATE users SET is_premium = $1 WHERE id = $2', [value, req.userId]);
    res.json({ premium: value });
});

module.exports = router;
