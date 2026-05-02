const router = require('express').Router();
const authRequired = require('../middleware/authRequired');
const { query } = require('../db');
const { roundCell } = require('../services/geo');
const storage = require('../services/storage');

router.use(authRequired);

const publicFields = `
    id, name, age, gender, bio, photos, preferences,
    discoverable, friend_optout, is_premium, created_at
`;

router.get('/me', async (req, res) => {
    const { rows } = await query(
        `SELECT ${publicFields}, lat_cell, lng_cell FROM users WHERE id = $1`,
        [req.userId]
    );
    res.json(rows[0]);
});

router.patch('/me', async (req, res) => {
    const {
        name, age, gender, bio, photos, preferences,
        lat, lng, discoverable, friend_optout,
    } = req.body;

    if (age != null && age < 18) return res.status(400).json({ error: 'underage' });

    // Coalesce-style update so the client can send partial payloads.
    await query(
        `UPDATE users SET
            name          = COALESCE($2, name),
            age           = COALESCE($3, age),
            gender        = COALESCE($4, gender),
            bio           = COALESCE($5, bio),
            photos        = COALESCE($6, photos),
            preferences   = COALESCE($7, preferences),
            lat_cell      = COALESCE($8, lat_cell),
            lng_cell      = COALESCE($9, lng_cell),
            discoverable  = COALESCE($10, discoverable),
            friend_optout = COALESCE($11, friend_optout),
            updated_at    = now()
          WHERE id = $1`,
        [
            req.userId, name, age, gender, bio, photos,
            preferences ? JSON.stringify(preferences) : null,
            roundCell(lat), roundCell(lng),
            discoverable, friend_optout,
        ]
    );
    res.json({ ok: true });
});

router.post('/upload-url', async (req, res) => {
    const { contentType } = req.body;
    const r = await storage.presignUpload({ userId: req.userId, contentType });
    res.json(r);
});

module.exports = router;
