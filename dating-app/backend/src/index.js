const express = require('express');
const cors = require('cors');
const config = require('./config');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

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

// Centralised error handler. Routes can throw and end up here.
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
});

app.listen(config.port, () => {
    console.log(`dating-app backend listening on :${config.port}`);
});
