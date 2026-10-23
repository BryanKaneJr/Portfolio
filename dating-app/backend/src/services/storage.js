// Cloud storage. Signs S3 PUT URLs so the mobile client uploads directly
// to S3 without proxying bytes through the API.
//
// If S3 is not configured, we fall back to a local dev mode: the client
// POSTs bytes to /uploads and we serve them back from the same path. This
// keeps the story/photo flow demoable without AWS credentials.
const crypto = require('crypto');
const config = require('../config');

let s3Client, getSignedUrl, PutObjectCommand;
try {
    ({ S3Client: s3Client, PutObjectCommand } = require('@aws-sdk/client-s3'));
    ({ getSignedUrl } = require('@aws-sdk/s3-request-presigner'));
} catch {
    // aws-sdk isn't installed yet in dev - that's OK, we fall through to local mode.
}

const isConfigured = () =>
    Boolean(s3Client && config.s3.bucket && config.s3.accessKey);

const publicUrlFor = (key) => {
    if (config.s3.publicBaseUrl) return `${config.s3.publicBaseUrl.replace(/\/$/, '')}/${key}`;
    return `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com/${key}`;
};

let clientInstance;
const getClient = () => {
    if (!clientInstance && s3Client) {
        clientInstance = new s3Client({
            region: config.s3.region,
            credentials: {
                accessKeyId: config.s3.accessKey,
                secretAccessKey: config.s3.secretKey,
            },
        });
    }
    return clientInstance;
};

const presignUpload = async ({ userId, contentType = 'image/jpeg' }) => {
    const ext = (contentType.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '');
    const key = `uploads/${userId}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;

    if (!isConfigured()) {
        // Dev fallback: mobile client will POST the bytes to /uploads and we'll
        // serve them from disk. The publicUrl points at that endpoint.
        return {
            mode: 'local',
            key,
            uploadUrl: `/uploads/${key}`,
            publicUrl: `/uploads/${key}`,
            contentType,
        };
    }

    const cmd = new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
        ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(getClient(), cmd, { expiresIn: 300 });
    return {
        mode: 's3',
        key,
        uploadUrl,
        publicUrl: publicUrlFor(key),
        contentType,
    };
};

module.exports = { presignUpload, isConfigured, publicUrlFor };
