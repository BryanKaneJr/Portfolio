// Dev-only auth provider. Enabled when DEV_AUTH=1 in the environment.
// Never enable in production - this is here so the app can be demoed and
// e2e-tested without a real Meta app.
//
// The "code" is treated as a handle. Different handles produce different
// deterministic provider IDs, so calling /auth/dev/callback with the same
// handle twice returns the same user. Additionally, if the handle contains
// a "+friend=<other>" suffix, the two users become friend-linked - handy
// for exercising the More Than Friends flow without a real Facebook graph.
const config = require('../config');
const crypto = require('crypto');

const isEnabled = () => Boolean(config.devAuth);

const hash = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

const exchangeCode = async (code) => {
    if (!isEnabled()) throw new Error('dev_auth_disabled');
    const [handleRaw, ...tags] = code.trim().split('+');
    const handle = handleRaw.toLowerCase().replace(/[^a-z0-9]/g, '') || 'anon';
    const friendHandles = tags
        .map((t) => t.split('=')[1])
        .filter(Boolean)
        .map((h) => hash('dev:' + h.toLowerCase().replace(/[^a-z0-9]/g, '')));

    return {
        providerId: hash('dev:' + handle),
        name: handle.charAt(0).toUpperCase() + handle.slice(1),
        // Dev accounts default to a sensible adult age.
        age: 25,
        photos: [],
        friendIds: friendHandles,
        accessToken: 'dev',
    };
};

module.exports = { isEnabled, exchangeCode };
