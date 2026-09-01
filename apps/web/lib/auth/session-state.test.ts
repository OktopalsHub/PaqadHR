import assert from 'node:assert/strict';
import test from 'node:test';
import { isServerValidatedSession, isSessionBootstrapLoading } from './session-state.ts';

const user = { id: 'user-1', email: 'owner@example.com', name: '', role: 'OWNER' };

test('does not authenticate a cached placeholder profile', () => {
  assert.equal(isServerValidatedSession(user, true), false);
  assert.equal(isSessionBootstrapLoading(true, false, true), true);
});

test('unlocks the app after the server profile response resolves', () => {
  assert.equal(isServerValidatedSession(user, false), true);
  assert.equal(isSessionBootstrapLoading(true, false, false), false);
});
