import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import type { PrivacyConsentStatus } from '@/lib/api/privacy';
import { queryKeys } from '@/lib/query/keys';
import { applyAcceptedPrivacyConsentCache } from './use-privacy-consent.ts';

test('privacy consent cache keys are scoped per user', () => {
  assert.notDeepEqual(queryKeys.privacy.consent('user-a'), queryKeys.privacy.consent('user-b'));
});

test('accepting privacy policy updates only that user cache entry', () => {
  const client = new QueryClient();
  const userA: PrivacyConsentStatus = {
    currentVersion: '2.0',
    acceptedVersion: '1.0',
    needsReconsent: true,
  };
  const userB: PrivacyConsentStatus = {
    currentVersion: '2.0',
    acceptedVersion: '1.0',
    needsReconsent: true,
  };

  client.setQueryData(queryKeys.privacy.consent('user-a'), userA);
  client.setQueryData(queryKeys.privacy.consent('user-b'), userB);

  client.setQueryData(queryKeys.privacy.consent('user-a'), applyAcceptedPrivacyConsentCache);

  assert.deepEqual(client.getQueryData(queryKeys.privacy.consent('user-a')), {
    currentVersion: '2.0',
    acceptedVersion: '2.0',
    needsReconsent: false,
  });
  assert.deepEqual(client.getQueryData(queryKeys.privacy.consent('user-b')), userB);
});
