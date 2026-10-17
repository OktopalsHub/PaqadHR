import assert from 'node:assert/strict';
import test from 'node:test';
import { collectAllPages } from './leaves.ts';

const PAGE_SIZE = 100;

test('collectAllPages returns empty without extra requests when nothing exists', async () => {
  let calls = 0;
  const records = await collectAllPages(async () => {
    calls += 1;
    return [];
  }, PAGE_SIZE);

  assert.deepEqual(records, []);
  assert.equal(calls, 1, 'an empty first page should stop the walk');
});

test('collectAllPages never exceeds the API limit of 100 per request', async () => {
  // Regression: the calendar asked for limit=200, which PaginationDto @Max(100)
  // rejects with a 400, so approved leave silently vanished from the calendar.
  const requested: number[] = [];
  await collectAllPages(async () => {
    requested.push(PAGE_SIZE);
    return [];
  }, PAGE_SIZE);

  for (const size of requested) {
    assert.ok(size <= 100, `page size ${size} exceeds the API cap`);
  }
});

test('collectAllPages concatenates a full page with a short page', async () => {
  const first = Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: `a${i}` }));
  const second = [{ id: 'b0' }, { id: 'b1' }];

  const records = await collectAllPages(async (page) => (page === 1 ? first : second), PAGE_SIZE);

  assert.equal(records.length, PAGE_SIZE + second.length);
  assert.deepEqual(records[0], { id: 'a0' });
  assert.deepEqual(records.at(-1), { id: 'b1' });
});

test('collectAllPages follows a full page with another request, then stops on a short page', async () => {
  const requested: number[] = [];
  const full = Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: `a${i}` }));

  const records = await collectAllPages(async (page) => {
    requested.push(page);
    return page === 1 ? full : [{ id: 'last' }];
  }, PAGE_SIZE);

  // A full page means "there may be more", so page 2 must be fetched; its short
  // length is what ends the walk.
  assert.deepEqual(requested, [1, 2]);
  assert.equal(records.length, PAGE_SIZE + 1);
});

test('collectAllPages is bounded by maxPages', async () => {
  let calls = 0;
  const full = Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: `a${i}` }));

  const records = await collectAllPages(
    async () => {
      calls += 1;
      return full;
    },
    PAGE_SIZE,
    3,
  );

  assert.equal(calls, 3);
  assert.equal(records.length, PAGE_SIZE * 3);
});
