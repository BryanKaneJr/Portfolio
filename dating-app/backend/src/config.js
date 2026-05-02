require('dotenv').config();

const required = (key) => {
    const v = process.env[key];
    if (!v) throw new Error(`Missing required env: ${key}`);
    return v;
};

module.exports = {
    port: parseInt(process.env.PORT || '4000', 10),
    databaseUrl: required('DATABASE_URL'),
    jwtSecret: required('JWT_SECRET'),
    facebook: {
        appId: process.env.FACEBOOK_APP_ID || '',
        appSecret: process.env.FACEBOOK_APP_SECRET || '',
        redirectUri: process.env.FACEBOOK_REDIRECT_URI || '',
    },
    instagram: {
        appId: process.env.INSTAGRAM_APP_ID || '',
        appSecret: process.env.INSTAGRAM_APP_SECRET || '',
        redirectUri: process.env.INSTAGRAM_REDIRECT_URI || '',
    },
    s3: {
        bucket: process.env.S3_BUCKET || '',
        region: process.env.S3_REGION || '',
        accessKey: process.env.S3_ACCESS_KEY || '',
        secretKey: process.env.S3_SECRET_KEY || '',
    },
};
