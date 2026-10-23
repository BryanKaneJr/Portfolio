// Push notification dispatcher. Uses Expo's HTTP API which requires no SDK.
// Real deployment should batch and handle DeviceNotRegistered errors.
const fetch = require('node-fetch');
const { query } = require('../db');

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';

const send = async (userId, { title, body, data }) => {
    const { rows } = await query(
        'SELECT token FROM push_tokens WHERE user_id = $1',
        [userId]
    );
    if (!rows.length) return;
    const messages = rows.map((r) => ({
        to: r.token,
        sound: 'default',
        title,
        body,
        data: data || {},
    }));
    try {
        await fetch(EXPO_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messages),
        });
    } catch (err) {
        console.warn('push send failed', err.message);
    }
};

module.exports = { send };
