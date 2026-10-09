// Local dev upload sink. When S3 is not configured, storage.presignUpload
// returns a /uploads/... URL. The mobile client POSTs bytes here and later
// GETs them for display. Not for production use.
const path = require('path');
const fs = require('fs');
const express = require('express');
const authRequired = require('../middleware/authRequired');
const storage = require('../services/storage');

const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const router = express.Router();

// POST bytes (raw or base64-in-JSON). We accept raw octet-stream to keep the
// client trivial.
router.post('/uploads/:userId/:filename', authRequired,
    express.raw({ type: '*/*', limit: '10mb' }),
    (req, res) => {
        if (storage.isConfigured()) {
            return res.status(400).json({ error: 'use_s3' });
        }
        // Guard against the userId in the URL not matching the caller.
        if (req.params.userId !== req.userId) {
            return res.status(403).json({ error: 'wrong_user' });
        }
        const safeName = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const dir = path.join(UPLOAD_ROOT, req.params.userId);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, safeName), req.body);
        res.json({ ok: true, url: `/uploads/${req.params.userId}/${safeName}` });
    }
);

// Serve back what we've stored. Public reads are fine for MVP.
router.use('/uploads', express.static(UPLOAD_ROOT));

module.exports = router;
