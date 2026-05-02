const router = require('express').Router();
const facebook = require('../auth/facebook');
const instagram = require('../auth/instagram');
const { sign } = require('../auth/jwt');
const { tx, query } = require('../db');

const PROVIDERS = { facebook, instagram };

// Single shared callback handler so the OAuth surface is small and uniform.
// The mobile client opens the provider's auth URL itself, then posts the code
// back here. This is the ONLY way to get a session - no password / email path.
const callback = async (req, res, providerName) => {
    const provider = PROVIDERS[providerName];
    if (!provider.isEnabled()) {
        return res.status(503).json({ error: `${providerName}_not_configured` });
    }
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'missing_code' });

    let ext;
    try {
        ext = await provider.exchangeCode(code);
    } catch (err) {
        return res.status(401).json({ error: err.message });
    }

    // 18+ gate. If age is known and < 18, reject. If unknown (Instagram), the
    // user must self-attest in EditProfile - we set a placeholder of 18 so the
    // CHECK constraint passes, then EditProfile overwrites with the real age.
    if (ext.age != null && ext.age < 18) {
        return res.status(403).json({ error: 'underage' });
    }

    const userId = await tx(async (client) => {
        const existing = await client.query(
            `SELECT u.id FROM users u
               JOIN social_accounts s ON s.user_id = u.id
              WHERE s.provider = $1 AND s.provider_id = $2`,
            [providerName, ext.providerId]
        );
        let id;
        if (existing.rows[0]) {
            id = existing.rows[0].id;
            await client.query(
                'UPDATE social_accounts SET access_token = $1 WHERE user_id = $2 AND provider = $3',
                [ext.accessToken, id, providerName]
            );
        } else {
            const ins = await client.query(
                `INSERT INTO users (name, age, photos)
                 VALUES ($1, $2, $3)
                 RETURNING id`,
                [ext.name, ext.age || 18, ext.photos]
            );
            id = ins.rows[0].id;
            await client.query(
                `INSERT INTO social_accounts (user_id, provider, provider_id, access_token)
                 VALUES ($1, $2, $3, $4)`,
                [id, providerName, ext.providerId, ext.accessToken]
            );
        }

        // Friend link upsert: only friends already on the app produce a row.
        if (ext.friendIds.length) {
            const friendUsers = await client.query(
                `SELECT user_id, provider_id FROM social_accounts
                  WHERE provider = $1 AND provider_id = ANY($2::text[])`,
                [providerName, ext.friendIds]
            );
            for (const f of friendUsers.rows) {
                if (f.user_id === id) continue;
                // Mutual friendship - insert both directions.
                await client.query(
                    `INSERT INTO friend_links (user_id, friend_id, provider)
                     VALUES ($1, $2, $3), ($2, $1, $3)
                     ON CONFLICT DO NOTHING`,
                    [id, f.user_id, providerName]
                );
            }
        }

        return id;
    });

    res.json({ token: sign(userId), userId });
};

router.post('/facebook/callback', (req, res) => callback(req, res, 'facebook'));
router.post('/instagram/callback', (req, res) => callback(req, res, 'instagram'));

// Surface which providers are enabled so the client can hide buttons
// that aren't wired up yet.
router.get('/providers', (_req, res) => {
    res.json({
        facebook: facebook.isEnabled(),
        instagram: instagram.isEnabled(),
    });
});

// Push token registration.
router.post('/push-token', require('../middleware/authRequired'), async (req, res) => {
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ error: 'missing_token' });
    await query(
        `INSERT INTO push_tokens (user_id, token, platform)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [req.userId, token, platform || null]
    );
    res.json({ ok: true });
});

module.exports = router;
