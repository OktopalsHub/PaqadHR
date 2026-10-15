import assert from 'node:assert/strict';
import test from 'node:test';
import {
  beginNetworkActivity,
  getNetworkActivitySnapshot,
  subscribeToNetworkActivity,
} from './network-activity';

test('tracks concurrent requests until each request finishes', () => {
  const snapshots: boolean[] = [];
  const unsubscribe = subscribeToNetworkActivity(() => {
    snapshots.push(getNetworkActivitySnapshot());
  });

  const finishFirst = beginNetworkActivity();
  const finishSecond = beginNetworkActivity();
  finishFirst();
  assert.equal(getNetworkActivitySnapshot(), true);

  finishSecond();
  finishSecond();
  unsubscribe();

  assert.equal(getNetworkActivitySnapshot(), false);
  assert.deepEqual(snapshots, [true, true, true, false]);
});
