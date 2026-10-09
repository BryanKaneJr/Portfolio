const router = require('express').Router();
const authRequired = require('../middleware/authRequired');
const { query } = require('../db');
const { haversineKm, bucketKm, CELL } = require('../services/geo');
const { tryCreateSwipeMatch } = require('../services/matching');

router.use(authRequired);

// Daily like cap for non-premium users. Premium = unlimited.
const FREE_DAILY_LIKE_CAP = 50;

const checkLikeQuota = async (userId) => {
    const { rows } = await query(
        `SELECT is_premium,
                (SELECT count(*) FROM swipes
                  WHERE swiper_id = $1
                    AND direction = 'like'
                    AND created_at > now() - interval '24 hours') AS used
           FROM users WHERE id = $1`,
        [userId]
    );
    const u = rows[0];
    if (u.is_premium) return { allowed: true };
    return { allowed: parseInt(u.used, 10) < FREE_DAILY_LIKE_CAP };
};

// Feed: discoverable users that the viewer hasn't already swiped on or blocked,
// not banned, mutually visible per gender prefs, within max_km.
router.get('/feed', async (req, res) => {
    const { rows: meRows } = await query(
        `SELECT lat_cell, lng_cell, preferences FROM users WHERE id = $1`,
        [req.userId]
    );
    const me = meRows[0];
    const prefs = me.preferences || {};
    const maxKm = prefs.max_km || 50;
    const prefGender = prefs.gender || null;
    const minAge = prefs.min_age || 18;
    const maxAge = prefs.max_age || 99;

    // Bounding-box pre-filter on lat/lng cells. Approx degrees per km:
    const dLat = maxKm / 111;
    const dLng = maxKm / 85;

    const { rows } = await query(
        `SELECT id, name, age, gender, bio, photos, lat_cell, lng_cell
           FROM users
          WHERE id <> $1
            AND is_banned = FALSE
            AND discoverable = TRUE
            AND age BETWEEN $2 AND $3
            AND ($4::text IS NULL OR gender = $4)
            AND (lat_cell IS NULL OR lat_cell BETWEEN $5 - $7 AND $5 + $7)
            AND (lng_cell IS NULL OR lng_cell BETWEEN $6 - $8 AND $6 + $8)
            AND id NOT IN (SELECT target_id FROM swipes WHERE swiper_id = $1)
            AND id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = $1)
            AND id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = $1)
          LIMIT 50`,
        [req.userId, minAge, maxAge, prefGender,
         me.lat_cell, me.lng_cell, dLat, dLng]
    );

    const out = rows
        .map((u) => {
            const km = haversineKm(
                { lat: me.lat_cell, lng: me.lng_cell },
                { lat: u.lat_cell, lng: u.lng_cell }
            );
            return { ...u, lat_cell: undefined, lng_cell: undefined,
                     distance_bucket: bucketKm(km), _km: km };
        })
        .filter((u) => u._km == null || u._km <= maxKm)
        .map(({ _km, ...rest }) => rest);

    res.json(out);
});

router.post('/swipe', async (req, res) => {
    const { targetId, direction } = req.body;
    if (!['like', 'pass'].includes(direction)) {
        return res.status(400).json({ error: 'bad_direction' });
    }
    if (targetId === req.userId) return res.status(400).json({ error: 'self' });

    if (direction === 'like') {
        const quota = await checkLikeQuota(req.userId);
        if (!quota.allowed) return res.status(429).json({ error: 'like_limit' });
    }

    await query(
        `INSERT INTO swipes (swiper_id, target_id, direction)
         VALUES ($1, $2, $3)
         ON CONFLICT (swiper_id, target_id) DO UPDATE SET direction = EXCLUDED.direction`,
        [req.userId, targetId, direction]
    );

    if (direction === 'like') {
        const result = await tryCreateSwipeMatch(req.userId, targetId);
        return res.json(result);
    }
    res.json({ matched: false });
});

// Premium-only: see who liked you.
router.get('/likes-received', async (req, res) => {
    const { rows: meRows } = await query(
        `SELECT is_premium FROM users WHERE id = $1`, [req.userId]
    );
    if (!meRows[0].is_premium) return res.status(402).json({ error: 'premium_required' });

    const { rows } = await query(
        `SELECT u.id, u.name, u.age, u.photos
           FROM swipes s JOIN users u ON u.id = s.swiper_id
          WHERE s.target_id = $1 AND s.direction = 'like'
            AND NOT EXISTS (
                SELECT 1 FROM swipes s2
                 WHERE s2.swiper_id = $1 AND s2.target_id = s.swiper_id
            )
          ORDER BY s.created_at DESC LIMIT 50`,
        [req.userId]
    );
    res.json(rows);
});

// Boost: bump the user to the top of others' feeds for ~30 minutes.
// MVP stub: just returns ok. Real impl would set a timestamp and use it in feed ranking.
router.post('/boost', async (req, res) => {
    const { rows } = await query('SELECT is_premium FROM users WHERE id = $1', [req.userId]);
    if (!rows[0].is_premium) return res.status(402).json({ error: 'premium_required' });
    res.json({ ok: true, boostedFor: '30m' });
});

module.exports = router;
