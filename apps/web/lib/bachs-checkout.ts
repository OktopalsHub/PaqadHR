type BachsCheckoutEvent = {
  type: string;
  data?: { reference?: string; reason?: string; message?: string };
};

type BachsSdk = {
  Initialize: (options: {
    baseUrl?: string;
    onEvent?: (event: BachsCheckoutEvent) => void;
  }) => BachsSdk;
  Checkout: {
    open: (args: {
      checkoutUrl: string;
      onEvent?: (event: BachsCheckoutEvent) => void;
      options?: { showCloseButton?: boolean; autoCloseOnComplete?: boolean };
    }) => Promise<void>;
    close: () => void;
    isOpen: () => boolean;
  };
};

const BACHS_SCRIPT_SRC = 'https://checkout.bachs.io/bachs.js';
const BACHS_CHECKOUT_HOSTS = new Set(['checkout.bachs.io', 'sandbox-checkout.bachs.io']);
/** A blocked or stalled loader must fall back to the hosted page instead of hanging forever. */
const BACHS_SDK_TIMEOUT_MS = 10_000;
/** `Checkout.open()` resolves once the modal is mounted; a stuck mount falls back too. */
const BACHS_OPEN_TIMEOUT_MS = 10_000;

let loadPromise: Promise<BachsSdk> | null = null;
/** Which SDK instance currently holds which checkout origin, so we never skip Initialize. */
let initialized: { sdk: BachsSdk; baseUrl: string } | null = null;

declare global {
  interface Window {
    Bachs?: BachsSdk;
  }
}

/** Origin of a Bachs hosted checkout URL, or null when the URL is not Bachs-hosted. */
function bachsCheckoutOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    return BACHS_CHECKOUT_HOSTS.has(parsed.hostname) ? parsed.origin : null;
  } catch {
    return null;
  }
}

export function isBachsCheckoutUrl(url: string): boolean {
  return bachsCheckoutOrigin(url) !== null;
}

function failSdkLoad(script: HTMLScriptElement | null, reject: (error: Error) => void): void {
  loadPromise = null;
  script?.remove();
  reject(new Error('Bachs SDK failed to load'));
}

function loadBachsSdk(): Promise<BachsSdk> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Bachs checkout requires a browser'));
  }
  if (window.Bachs) return Promise.resolve(window.Bachs);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const succeed = (sdk: BachsSdk) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(sdk);
    };
    const fail = (element: HTMLScriptElement | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      failSdkLoad(element, reject);
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${BACHS_SCRIPT_SRC}"]`);
    if (existing) {
      const nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce;
      if (nonce && !existing.nonce) existing.nonce = nonce;
      existing.addEventListener('load', () => {
        if (window.Bachs) succeed(window.Bachs);
        else fail(existing);
      });
      existing.addEventListener('error', () => fail(existing));
      if (window.Bachs) {
        succeed(window.Bachs);
        return;
      }
      // The tag is already in the document (possibly stalled by a proxy or an extension that
      // never fires `error`), so bound the wait and let the caller redirect instead.
      timer = setTimeout(() => fail(existing), BACHS_SDK_TIMEOUT_MS);
      return;
    }

    const script = document.createElement('script');
    script.src = BACHS_SCRIPT_SRC;
    script.async = true;
    // Carry Next.js's request nonce onto the third-party loader so SDKs that
    // create follow-up scripts can inherit the page's nonce-based CSP policy.
    const nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce;
    if (nonce) script.nonce = nonce;
    script.onload = () => {
      if (window.Bachs) succeed(window.Bachs);
      else fail(script);
    };
    script.onerror = () => fail(script);
    document.head.appendChild(script);
    // A stalled request (captive portal, DNS blackhole, extension that swallows the request
    // without firing `error`) would otherwise leave the checkout button spinning forever.
    // `failSdkLoad` also clears the cached promise so the next attempt can load again.
    timer = setTimeout(() => fail(script), BACHS_SDK_TIMEOUT_MS);
  });

  return loadPromise;
}

async function ensureInitialized(baseUrl: string): Promise<BachsSdk> {
  const Bachs = await loadBachsSdk();
  // bachs.js validates `checkoutUrl` against `baseUrl` (live checkout by default), so a
  // sandbox session URL would be rejected with "checkoutUrl must be on
  // https://checkout.bachs.io". Re-initialize when the session origin changes, or when
  // window.Bachs is a different SDK instance (its config would not carry our baseUrl).
  if (initialized?.sdk !== Bachs || initialized.baseUrl !== baseUrl) {
    Bachs.Initialize({ baseUrl });
    initialized = { sdk: Bachs, baseUrl };
  }
  return Bachs;
}

export type OpenBachsCheckoutOptions = {
  onCompleted?: (reference?: string) => void;
  onClosed?: (reason?: string) => void;
  onFailed?: () => void;
};

/** Open the Bachs overlay for a Bachs checkout URL; return false when it cannot open. */
async function openBachsOverlay(
  checkoutUrl: string,
  options: OpenBachsCheckoutOptions = {},
): Promise<boolean> {
  const origin = bachsCheckoutOrigin(checkoutUrl);
  if (!origin) return false;

  try {
    const Bachs = await ensureInitialized(origin);
    // Wait for the modal to mount, but never longer than the timeout: a stuck mount means the
    // caller should fall back to the hosted checkout page rather than spin indefinitely.
    let openTimer: ReturnType<typeof setTimeout> | undefined;
    const mounted = await Promise.race([
      Bachs.Checkout.open({
        checkoutUrl,
        onEvent: (event) => {
          if (event.type === 'checkout.completed') {
            options.onCompleted?.(event.data?.reference);
          } else if (event.type === 'checkout.failed' || event.type === 'checkout.expired') {
            options.onFailed?.();
          } else if (event.type === 'checkout.closed') {
            options.onClosed?.(event.data?.reason);
          }
        },
      }).then(() => true),
      new Promise<boolean>((resolve) => {
        openTimer = setTimeout(() => resolve(false), BACHS_OPEN_TIMEOUT_MS);
      }),
    ]);
    if (openTimer) clearTimeout(openTimer);
    if (!mounted) return false;
  } catch {
    // SDK load / Initialize / open() failures all reject before anything is mounted
    // (bad token, wrong origin, script blocked). The hosted checkout page is a valid
    // fallback; fulfilment still waits on the collection.succeeded webhook.
    return false;
  }
  return true;
}

/**
 * Prefer Bachs overlay; fall back to full-page redirect for other providers or a
 * failed overlay. Returns `'overlay'` | `'redirect'`.
 */
export async function openCheckoutUrl(
  checkoutUrl: string,
  options: OpenBachsCheckoutOptions = {},
): Promise<'overlay' | 'redirect'> {
  if (await openBachsOverlay(checkoutUrl, options)) return 'overlay';
  window.location.assign(checkoutUrl);
  return 'redirect';
}

/**
 * Payroll opens a blank tab before the API returns. For Bachs, close it and use
 * the overlay on the current page; otherwise navigate the tab (or redirect).
 */
export async function openCheckoutUrlWithOptionalTab(
  checkoutUrl: string,
  checkoutTab: Window | null,
  options: OpenBachsCheckoutOptions = {},
): Promise<'overlay' | 'redirect'> {
  if (isBachsCheckoutUrl(checkoutUrl)) {
    checkoutTab?.close();
    if (await openBachsOverlay(checkoutUrl, options)) return 'overlay';
    window.location.assign(checkoutUrl);
    return 'redirect';
  }
  if (checkoutTab) {
    checkoutTab.opener = null;
    checkoutTab.location.href = checkoutUrl;
  } else {
    window.location.assign(checkoutUrl);
  }
  return 'redirect';
}
