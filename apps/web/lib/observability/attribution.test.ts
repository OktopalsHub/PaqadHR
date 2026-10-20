import assert from 'node:assert/strict';
import test from 'node:test';
import {
  type Attribution,
  attributionEventProperties,
  buildAttributionTouch,
  parseAttribution,
  toSignupAttribution,
} from './attribution.ts';

function touch(overrides: Partial<Parameters<typeof buildAttributionTouch>[0]> = {}) {
  return buildAttributionTouch({
    search: '',
    referrer: '',
    pathname: '/',
    currentHostname: 'paqadhr.com',
    now: new Date('2026-10-20T10:00:00.000Z'),
    ...overrides,
  });
}

test('reads UTM parameters into a campaign touch', () => {
  const { touch: value, hasCampaign } = touch({
    search: '?utm_source=linkedin&utm_medium=social&utm_campaign=launch&utm_content=hero',
    pathname: '/',
  });

  assert.equal(hasCampaign, true);
  assert.equal(value.source, 'linkedin');
  assert.equal(value.medium, 'social');
  assert.equal(value.campaign, 'launch');
  assert.equal(value.content, 'hero');
  assert.equal(value.landingPage, '/');
});

test('falls back to the external referrer and strips its query string', () => {
  const { touch: value, hasCampaign } = touch({
    referrer: 'https://www.google.com/search?q=hr+software',
    pathname: '/pricing',
  });

  assert.equal(hasCampaign, false);
  assert.equal(value.source, 'google.com');
  assert.equal(value.medium, 'referral');
  assert.equal(value.referrer, 'https://www.google.com/search');
  assert.equal(value.landingPage, '/pricing');
});

test('ignores same-site referrers and defaults to direct', () => {
  const { touch: value } = touch({ referrer: 'https://paqadhr.com/features' });

  assert.equal(value.source, 'direct');
  assert.equal(value.medium, 'direct');
  assert.equal(value.referrer, undefined);
});

test('captures ad click ids without needing utm parameters', () => {
  const { touch: value, hasCampaign } = touch({ search: '?gclid=abc123' });

  assert.equal(hasCampaign, true);
  assert.equal(value.source, 'direct');
  assert.equal(value.clickId, 'abc123');
  assert.equal(value.clickIdType, 'gclid');
});

test('rejects malformed or incomplete stored attribution', () => {
  assert.equal(parseAttribution('not-json'), null);
  assert.equal(parseAttribution(encodeURIComponent(JSON.stringify({ first: {}, last: {} }))), null);
});

test('parses a stored attribution round-trip and drops unknown fields', () => {
  const stored: Attribution = {
    first: {
      source: 'newsletter',
      medium: 'email',
      campaign: 'october',
      capturedAt: '2026-10-01T09:00:00.000Z',
    },
    last: {
      source: 'linkedin',
      medium: 'social',
      campaign: 'launch',
      capturedAt: '2026-10-20T10:00:00.000Z',
    },
  };
  const raw = encodeURIComponent(
    JSON.stringify({ ...stored, injected: 'drop-me', first: { ...stored.first, extra: 'x' } }),
  );

  const parsed = parseAttribution(raw);
  assert.equal(parsed?.first.source, 'newsletter');
  assert.equal(parsed?.first.campaign, 'october');
  assert.equal(parsed?.last.source, 'linkedin');
  assert.equal(parsed?.last.capturedAt, '2026-10-20T10:00:00.000Z');
  assert.equal((parsed?.first as unknown as Record<string, unknown>).extra, undefined);
  assert.equal((parsed as unknown as Record<string, unknown>).injected, undefined);
});

test('signup payload keeps first touch when it differs from the last touch', () => {
  const payload = toSignupAttribution({
    first: {
      source: 'newsletter',
      medium: 'email',
      campaign: 'october',
      capturedAt: '2026-10-01T09:00:00.000Z',
    },
    last: {
      source: 'linkedin',
      medium: 'social',
      campaign: 'launch',
      capturedAt: '2026-10-20T10:00:00.000Z',
    },
  });

  assert.equal(payload.source, 'linkedin');
  assert.equal(payload.firstSource, 'newsletter');
  assert.equal(payload.firstCampaign, 'october');
});

test('PostHog properties expose source and campaign', () => {
  const properties = attributionEventProperties({
    first: {
      source: 'direct',
      medium: 'direct',
      capturedAt: '2026-10-01T09:00:00.000Z',
    },
    last: {
      source: 'linkedin',
      medium: 'social',
      campaign: 'launch',
      landingPage: '/',
      capturedAt: '2026-10-20T10:00:00.000Z',
    },
  });

  assert.equal(properties.signup_source, 'linkedin');
  assert.equal(properties.signup_medium, 'social');
  assert.equal(properties.utm_campaign, 'launch');
  assert.equal(properties.utm_source, 'linkedin');
  assert.equal(properties.first_touch_source, 'direct');
});
