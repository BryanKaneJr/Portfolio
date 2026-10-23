const fetch = require('node-fetch');
const config = require('../config');

const isEnabled = () =>
    Boolean(config.facebook.appId && config.facebook.appSecret);

// Exchange OAuth code for access_token, then fetch profile + friends.
// Returns { providerId, name, age, photos, friendIds, accessToken }.
const exchangeCode = async (code) => {
    if (!isEnabled()) throw new Error('facebook_not_configured');

    const tokenRes = await fetch(
        'https://graph.facebook.com/v18.0/oauth/access_token?' +
            new URLSearchParams({
                client_id: config.facebook.appId,
                client_secret: config.facebook.appSecret,
                redirect_uri: config.facebook.redirectUri,
                code,
            })
    );
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
        throw new Error('facebook_token_exchange_failed');
    }
    const accessToken = tokenJson.access_token;

    // Profile. We request birthday so we can compute age + enforce 18+.
    const fields = 'id,name,birthday,picture.type(large)';
    const meRes = await fetch(
        `https://graph.facebook.com/me?fields=${fields}&access_token=${accessToken}`
    );
    const me = await meRes.json();
    if (!meRes.ok) throw new Error('facebook_profile_failed');

    // Friends who *also* use this app, per Meta policy.
    const friendsRes = await fetch(
        `https://graph.facebook.com/me/friends?access_token=${accessToken}`
    );
    const friendsJson = await friendsRes.json();
    const friendIds = (friendsJson.data || []).map((f) => f.id);

    return {
        providerId: me.id,
        name: me.name,
        age: ageFromBirthday(me.birthday),
        photos: me.picture && me.picture.data ? [me.picture.data.url] : [],
        friendIds,
        accessToken,
    };
};

const ageFromBirthday = (s) => {
    // Facebook returns MM/DD/YYYY when permission allows.
    if (!s) return null;
    const parts = s.split('/');
    if (parts.length !== 3) return null;
    const [m, d, y] = parts.map((n) => parseInt(n, 10));
    if (!y) return null;
    const now = new Date();
    let age = now.getUTCFullYear() - y;
    const past =
        now.getUTCMonth() + 1 > m ||
        (now.getUTCMonth() + 1 === m && now.getUTCDate() >= d);
    if (!past) age -= 1;
    return age;
};

module.exports = { isEnabled, exchangeCode };
