const fetch = require('node-fetch');
const config = require('../config');

const isEnabled = () =>
    Boolean(config.instagram.appId && config.instagram.appSecret);

// Instagram Basic Display does NOT expose a friends/follower list.
// We therefore can't seed friend_links from Instagram - that's a documented
// Meta API limitation. We still allow Instagram-only sign-in.
const exchangeCode = async (code) => {
    if (!isEnabled()) throw new Error('instagram_not_configured');

    const form = new URLSearchParams({
        client_id: config.instagram.appId,
        client_secret: config.instagram.appSecret,
        grant_type: 'authorization_code',
        redirect_uri: config.instagram.redirectUri,
        code,
    });
    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        body: form,
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
        throw new Error('instagram_token_exchange_failed');
    }
    const accessToken = tokenJson.access_token;
    const providerId = String(tokenJson.user_id);

    const meRes = await fetch(
        `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`
    );
    const me = await meRes.json();

    return {
        providerId,
        name: me.username || 'Instagram user',
        age: null, // not available; user must complete profile to confirm 18+
        photos: [],
        friendIds: [], // not available via Instagram Basic Display
        accessToken,
    };
};

module.exports = { isEnabled, exchangeCode };
