const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // for rate limits behind reverse proxy
app.use(cors());
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
// JSON parser is skipped on the uploads write path (which uses raw bytes).
app.use((req, res, next) => {
    if (req.path.startsWith('/uploads/') && req.method === 'POST') return next();
    express.json({ limit: '1mb' })(req, res, next);
});

app.get('/health', (_req, res) => res.json({ ok: true, env: config.nodeEnv }));

app.use('/auth', require('./routes/auth'));
app.use('/profile', require('./routes/profile'));
app.use('/swipe', require('./routes/swipe'));
app.use('/matches', require('./routes/matches'));
app.use('/chat', require('./routes/chat'));
app.use('/friends', require('./routes/friends'));
app.use('/stories', require('./routes/stories'));
app.use('/reports', require('./routes/reports'));
app.use('/admin', require('./routes/admin'));
app.use('/billing', require('./routes/billing'));
// Uploads route provides both POST /uploads/:userId/:filename and static
// serving under /uploads/... - used when S3 is not configured.
app.use('/', require('./routes/uploads'));

// Admin dashboard: a tiny static HTML page that talks to /admin/* using a JWT
// pasted by the operator. Kept intentionally minimal so it can be embedded
// in a real portal later.
app.use('/dashboard', express.static(path.resolve(__dirname, '../public')));

// Centralised error handler. Routes can throw and end up here.
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
});

if (require.main === module) {
    app.listen(config.port, () => {
        console.log(`dating-app backend listening on :${config.port}`);
    });
}

module.exports = app;
