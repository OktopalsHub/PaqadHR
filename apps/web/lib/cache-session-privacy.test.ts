import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const store = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
Object.assign(globalThis, { window: globalThis, sessionStorage: fakeStorage });

const loadCache = () => import('./cache.ts');

beforeEach(() => store.clear());

test('an entry left by an older build is purged and not returned', async () => {
  const { cacheKeys, getCached, setCached } = await loadCache();
  store.set('paqad_cache_auth_session', JSON.stringify({ user: { email: 'old@b.co' } }));
  store.set('paqad_cache_expiry_auth_session', String(Date.now() + 60_000));
  assert.equal(getCached('auth_session'), null);
  assert.equal(store.size, 0);
});

test('the session bootstrap, which holds the email, is never written to sessionStorage', async () => {
  const { cacheKeys, getCached, setCached } = await loadCache();
  setCached(cacheKeys.auth.session, { user: { email: 'a@b.co' } });
  assert.deepEqual(getCached(cacheKeys.auth.session), { user: { email: 'a@b.co' } });
  assert.equal([...store.values()].some((v) => v.includes('a@b.co')), false);
});

test('other keys still persist', async () => {
  const { setCached } = await loadCache();
  setCached('tenants_all', [{ id: 1 }]);
  assert.equal(store.size > 0, true);
});
