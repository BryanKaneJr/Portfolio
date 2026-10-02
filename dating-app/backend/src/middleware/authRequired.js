const { verify } = require('../auth/jwt');
const { query } = require('../db');

module.exports = async function authRequired(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const claims = token && verify(token);
    if (!claims) return res.status(401).json({ error: 'unauthenticated' });

    const { rows } = await query(
        'SELECT id, is_admin, is_banned FROM users WHERE id = $1',
        [claims.sub]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'unauthenticated' });
    if (user.is_banned) return res.status(403).json({ error: 'banned' });

    req.userId = user.id;
    req.isAdmin = user.is_admin;
    next();
};
