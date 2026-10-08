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

let loadPromise: Promise<BachsSdk> | null = null;
let initializedBaseUrl: string | null = null;

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
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${BACHS_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.Bachs) resolve(window.Bachs);
        else failSdkLoad(existing, reject);
      });
      existing.addEventListener('error', () => failSdkLoad(existing, reject));
      if (window.Bachs) resolve(window.Bachs);
      return;
    }

    const script = document.createElement('script');
    script.src = BACHS_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.Bachs) resolve(window.Bachs);
      else failSdkLoad(script, reject);
    };
    script.onerror = () => failSdkLoad(script, reject);
    document.head.appendChild(script);
  });

  return loadPromise;
}

async function ensureInitialized(baseUrl: string): Promise<BachsSdk> {
  const Bachs = await loadBachsSdk();
  // bachs.js validates `checkoutUrl` against `baseUrl` (live checkout by default), so a
  // sandbox session URL would be rejected with "checkoutUrl must be on
  // https://checkout.bachs.io". Re-initialize whenever the session origin changes.
  if (initializedBaseUrl !== baseUrl) {
    Bachs.Initialize({ baseUrl });
    initializedBaseUrl = baseUrl;
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

  const Bachs = await ensureInitialized(origin);
  try {
    await Bachs.Checkout.open({
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
    });
  } catch {
    // open() rejects before mounting anything (bad token, wrong origin, SDK load failure).
    // The hosted checkout page is a valid fallback; fulfilment still waits on the webhook.
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
