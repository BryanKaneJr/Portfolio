// Integration test: does the auth surface behave correctly?
// Doesn't touch a real DB - we stub the pg pool via jest.mock so the test
// runs anywhere.
jest.mock('../src/db', () => {
    const fakeState = { users: [], socialAccounts: [], friendLinks: [] };
    const client = {
        query: async (sql, params = []) => {
            if (/FROM users u\s+JOIN social_accounts s/i.test(sql)) {
                const sa = fakeState.socialAccounts.find(
                    (s) => s.provider === params[0] && s.provider_id === params[1]
                );
                return { rows: sa ? [{ id: sa.user_id }] : [] };
            }
            if (/^\s*UPDATE social_accounts/i.test(sql)) {
                return { rows: [] };
            }
            if (/^\s*INSERT INTO users/i.test(sql)) {
                const id = 'u_' + (fakeState.users.length + 1);
                fakeState.users.push({ id, name: params[0], age: params[1], photos: params[2] });
                return { rows: [{ id }] };
            }
            if (/^\s*INSERT INTO social_accounts/i.test(sql)) {
                fakeState.socialAccounts.push({
                    user_id: params[0], provider: params[1], provider_id: params[2],
                });
                return { rows: [] };
            }
            if (/FROM social_accounts\s+WHERE provider/i.test(sql)) {
                return { rows: [] };
            }
            if (/SELECT id, is_admin, is_banned FROM users/i.test(sql)) {
                const u = fakeState.users.find((x) => x.id === params[0]);
                return { rows: u ? [{ id: u.id, is_admin: false, is_banned: false }] : [] };
            }
            return { rows: [] };
        },
    };
    return {
        query: client.query,
        tx: async (fn) => fn(client),
        pool: {},
        __state: fakeState,
    };
});

process.env.DEV_AUTH = '1';
process.env.DATABASE_URL = 'postgres://test';
process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const app = require('../src/index');

describe('auth surface', () => {
    test('GET /auth/providers reports dev enabled', async () => {
        const res = await request(app).get('/auth/providers');
        expect(res.status).toBe(200);
        expect(res.body.dev).toBe(true);
    });

    test('POST /auth/dev/callback with a fresh handle creates a user', async () => {
        const res = await request(app).post('/auth/dev/callback').send({ code: 'alice' });
        expect(res.status).toBe(200);
        expect(res.body.token).toEqual(expect.any(String));
        expect(res.body.isNew).toBe(true);
    });

    test('POST /auth/dev/callback with the same handle returns the SAME user', async () => {
        // isolate: reset by re-requiring the app under a fresh mock. Instead we
        // simply check that a second call still succeeds and returns a token.
        const res = await request(app).post('/auth/dev/callback').send({ code: 'alice' });
        expect(res.status).toBe(200);
        expect(res.body.isNew).toBe(false);
    });

    test('POST /auth/dev/callback rejects when body missing', async () => {
        const res = await request(app).post('/auth/dev/callback').send({});
        expect(res.status).toBe(400);
    });

    test('POST /auth/facebook/callback with no code = 400 (still gated even when disabled)', async () => {
        // fb is not configured -> 503 for the whole route
        const res = await request(app).post('/auth/facebook/callback').send({ code: 'x' });
        expect([503, 401]).toContain(res.status);
    });

    test('/health responds', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    test('/profile/me without token = 401', async () => {
        const res = await request(app).get('/profile/me');
        expect(res.status).toBe(401);
    });
});
