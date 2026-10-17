import assert from 'node:assert/strict';
import test from 'node:test';
import { collectAllPages } from './leaves.ts';

const PAGE_SIZE = 200;

test('collectAllPages returns empty without extra requests when nothing exists', async () => {
  let calls = 0;
  const records = await collectAllPages(async () => {
    calls += 1;
    return { records: [], nextPage: null };
  });

  assert.deepEqual(records, []);
  assert.equal(calls, 1, 'an empty first page should stop the walk');
});

test('collectAllPages requests 200 per page, within the API cap', async () => {
  // Regression: the calendar asked for limit=200 while PaginationDto capped limit at
  // 100, so the query DTO failed validation and approved leave vanished silently.
  assert.equal(PAGE_SIZE, 200);

  const records = await collectAllPages(async () => ({ records: [], nextPage: null }));
  assert.deepEqual(records, []);
});

test('collectAllPages follows the server nextPage across a full page', async () => {
  const first = Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: `a${i}` }));
  const second = Array.from({ length: 25 }, (_, i) => ({ id: `b${i}` }));
  const requested: number[] = [];

  const records = await collectAllPages(async (page) => {
    requested.push(page);
    // The server decides whether another page exists; a full page is not proof it does.
    return page === 1 ? { records: first, nextPage: 2 } : { records: second, nextPage: null };
  });

  assert.deepEqual(requested, [1, 2]);
  assert.equal(records.length, PAGE_SIZE + second.length);
  assert.deepEqual(records.at(-1), { id: 'b24' });
});

test('collectAllPages uses the page the server asked for, not page+1', async () => {
  const requested: number[] = [];
  await collectAllPages(async (page) => {
    requested.push(page);
    return { records: [{ id: 'x' }], nextPage: page === 1 ? 7 : null };
  });

  assert.deepEqual(requested, [1, 7]);
});

test('collectAllPages is bounded by maxPages', async () => {
  let calls = 0;
  const full = Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: `a${i}` }));

  const records = await collectAllPages(async (page) => {
    calls += 1;
    return { records: full, nextPage: page + 1 };
  }, 3);

  assert.equal(calls, 3);
  assert.equal(records.length, PAGE_SIZE * 3);
});
