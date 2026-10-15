import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareApiRequestHeaders } from './api-request-headers.ts';

test('defaults string request bodies to application/json when content type is missing', () => {
  const headers = prepareApiRequestHeaders(undefined, JSON.stringify({ hello: 'world' }));

  assert.equal(headers.get('Content-Type'), 'application/json');
});

test('preserves caller-supplied lowercase content-type headers', () => {
  const headers = prepareApiRequestHeaders(
    {
      'content-type': 'text/plain',
      'x-request-id': 'req-1',
    },
    'plain text body',
  );

  assert.equal(headers.get('Content-Type'), 'text/plain');
  assert.equal(headers.get('x-request-id'), 'req-1');
});

test('does not force application/json for FormData bodies', () => {
  const formData = new FormData();
  formData.set('file', 'resume.pdf');

  const headers = prepareApiRequestHeaders(undefined, formData);

  assert.equal(headers.has('Content-Type'), false);
});
