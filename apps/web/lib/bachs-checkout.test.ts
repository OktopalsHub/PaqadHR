import assert from 'node:assert/strict';
import test from 'node:test';
import { isBachsCheckoutUrl, openCheckoutUrl } from './bachs-checkout.ts';

test('isBachsCheckoutUrl accepts Bachs hosted checkout hosts', () => {
  assert.equal(isBachsCheckoutUrl('https://checkout.bachs.io/c/token'), true);
  assert.equal(isBachsCheckoutUrl('https://sandbox-checkout.bachs.io/c/token'), true);
});

test('isBachsCheckoutUrl rejects other providers', () => {
  assert.equal(isBachsCheckoutUrl('https://checkout.nomba.com/pay'), false);
  assert.equal(isBachsCheckoutUrl('not-a-url'), false);
});

type SdkStub = {
  baseUrls: Array<string | undefined>;
  opened: string[];
  redirects: string[];
};

function stubBrowser(options: { failInitialize?: boolean; failOpen?: boolean } = {}): SdkStub {
  const stub: SdkStub = { baseUrls: [], opened: [], redirects: [] };
  const sdk = {
    Initialize: (init: { baseUrl?: string }) => {
      if (options.failInitialize) throw new Error('Initialize failed');
      stub.baseUrls.push(init.baseUrl);
      return sdk;
    },
    Checkout: {
      open: async (args: { checkoutUrl: string }) => {
        if (options.failOpen) throw new Error('checkoutUrl must be on https://checkout.bachs.io');
        stub.opened.push(args.checkoutUrl);
      },
    },
  };
  (globalThis as { window?: unknown }).window = {
    Bachs: sdk,
    location: { assign: (url: string) => stub.redirects.push(url) },
  };
  return stub;
}

// bachs.js rejects any checkoutUrl whose origin differs from Initialize({ baseUrl }),
// so a sandbox session must initialize the SDK on the sandbox origin.
test('initializes the SDK on each checkout session origin', async () => {
  const sdk = stubBrowser();

  assert.equal(await openCheckoutUrl('https://sandbox-checkout.bachs.io/c/sandbox'), 'overlay');
  assert.equal(await openCheckoutUrl('https://checkout.bachs.io/c/live'), 'overlay');

  assert.deepEqual(sdk.baseUrls, [
    'https://sandbox-checkout.bachs.io',
    'https://checkout.bachs.io',
  ]);
  assert.deepEqual(sdk.redirects, []);
});

test('falls back to the hosted checkout when the overlay cannot open', async () => {
  const sandboxUrl = 'https://sandbox-checkout.bachs.io/c/sandbox';
  const sdk = stubBrowser({ failOpen: true });
  assert.equal(await openCheckoutUrl(sandboxUrl), 'redirect');
  assert.deepEqual(sdk.redirects, [sandboxUrl]);
});

// window.Bachs can be replaced (script reload, fresh instance) without the URL changing.
// Skipping Initialize then would leave the new SDK on its default live origin.
test('re-initializes when window.Bachs is a different SDK instance', async () => {
  const sandboxUrl = 'https://sandbox-checkout.bachs.io/c/sandbox';
  const first = stubBrowser();
  await openCheckoutUrl(sandboxUrl);
  assert.deepEqual(first.baseUrls, ['https://sandbox-checkout.bachs.io']);

  const second = stubBrowser();
  await openCheckoutUrl(sandboxUrl);
  assert.deepEqual(second.baseUrls, ['https://sandbox-checkout.bachs.io']);
});

test('falls back to the hosted checkout when the SDK fails to initialize', async () => {
  const liveUrl = 'https://checkout.bachs.io/c/live';
  const sdk = stubBrowser({ failInitialize: true });
  assert.equal(await openCheckoutUrl(liveUrl), 'redirect');
  assert.deepEqual(sdk.redirects, [liveUrl]);
});
