import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveApiErrorMessage } from './client-error-message.ts';

test('api client reports a friendly message for network-level failures', () => {
  assert.equal(
    resolveApiErrorMessage(0, null),
    'Could not reach the server. Check your connection and try again.',
  );
});

test('api client prefers payload messages when the server provides one', () => {
  assert.equal(resolveApiErrorMessage(422, { message: 'Invalid credentials' }), 'Invalid credentials');
  assert.equal(
    resolveApiErrorMessage(422, { message: ['Email is required', 'Password is required'] }),
    'Email is required, Password is required',
  );
});
