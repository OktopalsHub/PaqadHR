import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHUNK_RELOAD_STORAGE_KEY,
  isStaleChunkError,
  markChunkReloadAttempted,
  shouldReloadForChunkError,
} from './chunk-reload.ts';
import {
  markVersionReloadAttempted,
  shouldReloadForVersion,
  VERSION_RELOAD_STORAGE_KEY,
} from './version-reload.ts';

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

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const store = { ...initial };
  return {
    get length() {
      return Object.keys(store).length;
    },
    clear() {
      for (const key of Object.keys(store)) delete store[key];
    },
    getItem(key: string) {
      return key in store ? store[key]! : null;
    },
    key() {
      return null;
    },
    removeItem(key: string) {
      delete store[key];
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
  };
}

function throwingStorage(method: 'getItem' | 'setItem'): Storage {
  const base = memoryStorage();
  return {
    ...base,
    getItem(key: string) {
      if (method === 'getItem') throw new Error('SecurityError');
      return base.getItem(key);
    },
    setItem(key: string, value: string) {
      if (method === 'setItem') throw new Error('QuotaExceededError');
      base.setItem(key, value);
    },
  };
}

test('chunk reload is one-shot per build id', () => {
  const storage = memoryStorage();
  assert.equal(shouldReloadForChunkError('build-a', storage), true);
  assert.equal(markChunkReloadAttempted('build-a', storage), true);
  assert.equal(storage.getItem(CHUNK_RELOAD_STORAGE_KEY), 'build-a');
  assert.equal(shouldReloadForChunkError('build-a', storage), false);
  assert.equal(shouldReloadForChunkError('build-b', storage), true);
});

test('chunk reload fails closed when storage throws', () => {
  assert.equal(shouldReloadForChunkError('build-a', throwingStorage('getItem')), false);
  assert.equal(markChunkReloadAttempted('build-a', throwingStorage('setItem')), false);
  assert.equal(shouldReloadForChunkError('build-a', null), false);
  assert.equal(markChunkReloadAttempted('build-a', null), false);
});

test('version reload is one-shot per remote build id', () => {
  const storage = memoryStorage();
  assert.equal(shouldReloadForVersion('remote-1', storage), true);
  assert.equal(markVersionReloadAttempted('remote-1', storage), true);
  assert.equal(storage.getItem(VERSION_RELOAD_STORAGE_KEY), 'remote-1');
  assert.equal(shouldReloadForVersion('remote-1', storage), false);
  assert.equal(shouldReloadForVersion('remote-2', storage), true);
});

test('version reload fails closed when storage throws', () => {
  assert.equal(shouldReloadForVersion('remote-1', throwingStorage('getItem')), false);
  assert.equal(markVersionReloadAttempted('remote-1', throwingStorage('setItem')), false);
  assert.equal(shouldReloadForVersion('remote-1', null), false);
  assert.equal(markVersionReloadAttempted('remote-1', null), false);
});
