// Jest setup: give the pure-function services the env vars they need to
// require db.js without erroring. The DB itself is never touched by these
// tests - they exercise the deterministic helpers only.
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
