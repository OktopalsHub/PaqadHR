import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { legalMarkdownToReact } from './legal-markdown';

describe('legalMarkdownToReact', () => {
  test('renders headings, links, bold, and tables', () => {
    const html = renderToStaticMarkup(
      legalMarkdownToReact(`# Title

See the [Privacy Policy](/privacy) and **Paqad**.

| Type | Purpose |
| --- | --- |
| Essential | Sign-in |
`),
    );
    assert.match(html, /<h1>Title<\/h1>/);
    assert.match(html, /href="\/privacy"/);
    assert.match(html, /Privacy Policy/);
    assert.match(html, /<strong>Paqad<\/strong>/);
    assert.match(html, /<th>Type<\/th>/);
    assert.match(html, /<td>Essential<\/td>/);
  });

  test('treats raw HTML as text, not markup', () => {
    const html = renderToStaticMarkup(legalMarkdownToReact('Hello <script>alert(1)</script>'));
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /<script>/);
  });
});
