module.exports = function adminRequired(req, res, next) {
    if (!req.isAdmin) return res.status(403).json({ error: 'admin_only' });
    next();
};
