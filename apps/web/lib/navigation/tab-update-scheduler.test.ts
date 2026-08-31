import assert from 'node:assert/strict';
import test from 'node:test';
import { createTabUrlUpdateScheduler } from './tab-update-scheduler.ts';

test('writes the latest tab when changed twice before queued work runs', () => {
  const queuedTasks: Array<() => void> = [];
  const updates: Array<{ tab: string; previousTab: string }> = [];
  const schedule = createTabUrlUpdateScheduler(
    (update) => updates.push(update),
    (task) => queuedTasks.push(task),
  );

  schedule('employment', 'personal');
  schedule('documents', 'employment');

  assert.equal(queuedTasks.length, 1);
  queuedTasks[0]();
  assert.deepEqual(updates, [{ tab: 'documents', previousTab: 'employment' }]);
});
