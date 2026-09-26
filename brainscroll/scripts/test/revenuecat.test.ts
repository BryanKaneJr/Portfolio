import assert from 'node:assert/strict';
import { test } from 'node:test';
import { entitlementFromSubscriber, webhookAuthorized } from '../../backend/supabase/functions/_shared/revenuecat.ts';

const now = new Date('2026-10-01T12:00:00Z');

test('no Unlimited entitlement means inactive', () => {
  assert.deepEqual(entitlementFromSubscriber({ subscriber: { entitlements: {} } }, now), { active: false, expiresAt: null, productId: null, store: null, willRenew: null });
});

test('an active monthly subscription that will renew', () => {
  const s = entitlementFromSubscriber(
    {
      subscriber: {
        entitlements: { unlimited_learning: { expires_date: '2026-11-01T12:00:00Z', product_identifier: 'unlimited_monthly' } },
        subscriptions: { unlimited_monthly: { store: 'app_store', expires_date: '2026-11-01T12:00:00Z', unsubscribe_detected_at: null } },
      },
    },
    now,
  );
  assert.deepEqual(s, { active: true, expiresAt: '2026-11-01T12:00:00Z', productId: 'unlimited_monthly', store: 'APP_STORE', willRenew: true });
});

test('cancelled: active until expiry, will not renew', () => {
  const s = entitlementFromSubscriber(
    {
      subscriber: {
        entitlements: { unlimited_learning: { expires_date: '2026-10-05T00:00:00Z', product_identifier: 'unlimited_annual' } },
        subscriptions: { unlimited_annual: { store: 'play_store', expires_date: '2026-10-05T00:00:00Z', unsubscribe_detected_at: '2026-09-30T00:00:00Z' } },
      },
    },
    now,
  );
  assert.equal(s.active, true);
  assert.equal(s.willRenew, false);
});

test('expired, but inside a billing grace period, stays active', () => {
  const s = entitlementFromSubscriber(
    { subscriber: { entitlements: { unlimited_learning: { expires_date: '2026-09-30T00:00:00Z', grace_period_expires_date: '2026-10-10T00:00:00Z', product_identifier: 'm' } } } },
    now,
  );
  assert.equal(s.active, true);
  assert.equal(s.expiresAt, '2026-10-10T00:00:00Z');
});

test('expired and past grace is inactive', () => {
  const s = entitlementFromSubscriber({ subscriber: { entitlements: { unlimited_learning: { expires_date: '2026-09-30T00:00:00Z', product_identifier: 'm' } } } }, now);
  assert.equal(s.active, false);
});

test('a grant with no expiry never lapses', () => {
  const s = entitlementFromSubscriber({ subscriber: { entitlements: { unlimited_learning: { expires_date: null, product_identifier: 'promo' } } } }, now);
  assert.equal(s.active, true);
  assert.equal(s.expiresAt, null);
});

test('webhook auth needs the exact bearer secret', () => {
  assert.equal(webhookAuthorized('Bearer s3cret', 's3cret'), true);
  assert.equal(webhookAuthorized('Bearer s3creT', 's3cret'), false);
  assert.equal(webhookAuthorized('s3cret', 's3cret'), false);
  assert.equal(webhookAuthorized(null, 's3cret'), false);
  assert.equal(webhookAuthorized('Bearer ', ''), false);
  assert.equal(webhookAuthorized('Bearer x', undefined), false);
});

test('a sandbox purchase counts only where sandbox is allowed (staging)', () => {
  const body = {
    subscriber: {
      entitlements: { unlimited_learning: { expires_date: '2026-11-01T12:00:00Z', product_identifier: 'unlimited_monthly' } },
      subscriptions: { unlimited_monthly: { store: 'app_store', is_sandbox: true, expires_date: '2026-11-01T12:00:00Z' } },
    },
  };
  assert.equal(entitlementFromSubscriber(body, now).active, false);
  assert.equal(entitlementFromSubscriber(body, now, true).active, true);
});
