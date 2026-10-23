const jwt = require('jsonwebtoken');
const config = require('../config');

const TTL = '30d';

const sign = (userId) => jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: TTL });

const verify = (token) => {
    try {
        return jwt.verify(token, config.jwtSecret);
    } catch {
        return null;
    }
};

module.exports = { sign, verify };
