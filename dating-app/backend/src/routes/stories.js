const router = require('express').Router();
const authRequired = require('../middleware/authRequired');
const { query } = require('../db');
const { roundCell, haversineKm, bucketKm } = require('../services/geo');
const { buildVisibility } = require('../services/storyVisibility');

router.use(authRequired);

router.post('/', async (req, res) => {
    const { imageUrl, caption, lat, lng } = req.body;
    if (!imageUrl) return res.status(400).json({ error: 'missing_image' });

    const { rows } = await query(
        `INSERT INTO stories (user_id, image_url, caption, lat_cell, lng_cell, expires_at)
         VALUES ($1, $2, $3, $4, $5, now() + interval '24 hours')
         RETURNING id, image_url, caption, created_at, expires_at`,
        [req.userId, imageUrl, caption || '', roundCell(lat), roundCell(lng)]
    );
    res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
    await query(
        `UPDATE stories SET removed = TRUE WHERE id = $1 AND user_id = $2`,
        [req.params.id, req.userId]
    );
    res.json({ ok: true });
});

// Local feed: stories visible to me, ordered by proximity then recency.
router.get('/feed', async (req, res) => {
    // $1 = viewer (used multiple times in the visibility predicate)
    const visibility = buildVisibility(1);
    const { rows: meRows } = await query(
        'SELECT lat_cell, lng_cell FROM users WHERE id = $1',
        [req.userId]
    );
    const me = meRows[0];

    const { rows } = await query(
        `SELECT s.id, s.image_url, s.caption, s.created_at, s.expires_at,
                s.lat_cell, s.lng_cell,
                p.id AS poster_id, p.name AS poster_name, p.photos AS poster_photos
           FROM stories s
           JOIN users p ON p.id = s.user_id
          WHERE ${visibility}
          ORDER BY s.created_at DESC
          LIMIT 100`,
        [req.userId]
    );

    const out = rows.map((r) => {
        const km = haversineKm(
            { lat: me.lat_cell, lng: me.lng_cell },
            { lat: r.lat_cell, lng: r.lng_cell }
        );
        return {
            id: r.id,
            image_url: r.image_url,
            caption: r.caption,
            created_at: r.created_at,
            expires_at: r.expires_at,
            distance_bucket: bucketKm(km),
            poster: {
                id: r.poster_id,
                name: r.poster_name,
                photos: r.poster_photos,
            },
        };
    });

    res.json(out);
});

router.get('/mine', async (req, res) => {
    const { rows } = await query(
        `SELECT id, image_url, caption, created_at, expires_at
           FROM stories
          WHERE user_id = $1 AND removed = FALSE AND expires_at > now()
          ORDER BY created_at DESC`,
        [req.userId]
    );
    res.json(rows);
});

module.exports = router;
