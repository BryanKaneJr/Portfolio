// Cloud storage stub. Real implementation should sign S3 PUT URLs.
// The mobile client uploads directly to S3, then sends us the public URL.
const config = require('../config');

const isConfigured = () => Boolean(config.s3.bucket && config.s3.accessKey);

// Stub: returns a fake presigned URL so the rest of the system can be wired up.
// Replace with @aws-sdk/s3-request-presigner in production.
const presignUpload = async ({ userId, contentType }) => {
    if (!isConfigured()) {
        return {
            uploadUrl: null,
            publicUrl: `https://placeholder.local/${userId}/${Date.now()}`,
            stub: true,
        };
    }
    const key = `uploads/${userId}/${Date.now()}`;
    return {
        uploadUrl: `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com/${key}`,
        publicUrl: `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com/${key}`,
        stub: true, // flip to false when real signing is implemented
        contentType,
    };
};

module.exports = { presignUpload, isConfigured };
