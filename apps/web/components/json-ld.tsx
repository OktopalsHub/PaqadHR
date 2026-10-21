type JsonLdNode = Record<string, unknown>;

/**
 * Server-rendered JSON-LD. Keeping this in the HTML (rather than injecting it in a
 * client effect) is what makes it visible to crawlers that fetch the document and
 * never execute JavaScript.
 *
 * No CSP nonce is attached on purpose. A `<script type="application/ld+json">` is a
 * data block, not an executable script, so `script-src` does not gate it. Reading the
 * nonce here would call `headers()` and opt every marketing page into dynamic
 * rendering, which costs a server render on every request.
 */
export function JsonLd({ data }: { data: JsonLdNode | JsonLdNode[] }) {
  const nodes = Array.isArray(data) ? data : [data];

  return (
    <>
      {nodes.map((node, index) => (
        <script
          // biome-ignore lint/suspicious/noArrayIndexKey: the payload is static per page
          key={index}
          type="application/ld+json"
          suppressHydrationWarning
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires inline script
          dangerouslySetInnerHTML={{ __html: JSON.stringify(node) }}
        />
      ))}
    </>
  );
}
