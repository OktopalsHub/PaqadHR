import assert from 'node:assert/strict';
import test from 'node:test';
import { isStaleChunkError } from './chunk-reload.ts';

test('isStaleChunkError matches known stale chunk messages', () => {
  assert.equal(isStaleChunkError(new Error('Loading chunk 123 failed')), true);
  assert.equal(isStaleChunkError(new Error('Failed to fetch dynamically imported module')), true);
  assert.equal(
    isStaleChunkError(Object.assign(new Error('missing'), { name: 'ChunkLoadError' })),
    true,
  );
  assert.equal(isStaleChunkError(new Error('Loading CSS chunk 9 failed')), true);
  assert.equal(isStaleChunkError(new Error('Importing a module script failed')), true);
});

test('isStaleChunkError ignores unrelated errors', () => {
  assert.equal(isStaleChunkError(new Error('Network request failed')), false);
  assert.equal(isStaleChunkError(null), false);
  assert.equal(isStaleChunkError(''), false);
});
