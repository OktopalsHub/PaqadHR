import assert from 'node:assert/strict';
import test from 'node:test';
import { decideUpdateFlow } from './update-prompt.ts';

test('visible tab with an unseen build prompts instead of reloading', () => {
  assert.equal(
    decideUpdateFlow({ remoteBuildId: 'build-2', promptedBuildId: null, isVisible: true }),
    'prompt',
  );
});

test('hidden tab reloads silently on first detection', () => {
  assert.equal(
    decideUpdateFlow({ remoteBuildId: 'build-2', promptedBuildId: null, isVisible: false }),
    'silentReload',
  );
});

test('an already prompted build is skipped, so it is never re-prompted or auto-reloaded', () => {
  assert.equal(
    decideUpdateFlow({ remoteBuildId: 'build-2', promptedBuildId: 'build-2', isVisible: true }),
    'skip',
  );
  assert.equal(
    decideUpdateFlow({ remoteBuildId: 'build-2', promptedBuildId: 'build-2', isVisible: false }),
    'skip',
  );
});
