import assert from 'node:assert/strict';
import test from 'node:test';
import { submitHandledAuthAction } from './submit-handled-auth-action.ts';

test('handled auth submit resolves after a rejected action', async () => {
  let calls = 0;

  await assert.doesNotReject(async () => {
    await submitHandledAuthAction(async () => {
      calls += 1;
      throw new Error('Request failed');
    });
  });

  assert.equal(calls, 1);
});

test('handled auth submit preserves successful completion', async () => {
  let completed = false;

  await submitHandledAuthAction(async () => {
    completed = true;
  });

  assert.equal(completed, true);
});
