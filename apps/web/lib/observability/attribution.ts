import { getAppDomain } from '@/lib/navigation/tenant-routes';

/**
 * First-party campaign attribution.
 *
 * A visitor's marketing context is captured on their first page load and kept
 * in a first-party cookie, so a signup can still be attributed to the campaign
 * that brought them in even after they navigate around the marketing site.
 *
 * We never store raw query strings — only allow-listed campaign fields, and
 * referrer origins/paths without query parameters (which can contain PII).
 */

export const ATTRIBUTION_COOKIE_NAME = 'paqad_attribution';
export const ATTRIBUTION_COOKIE_MAX_AGE_DAYS = 90;

export const UTM_PARAM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
] as const;

export const CLICK_ID_PARAM_KEYS = [
  'gclid',
  'gbraid',
  'wbraid',
  'dclid',
  'fbclid',
  'li_fat_id',
  'ttclid',
  'twclid',
  'msclkid',
] as const;

const SHORT_FIELD_MAX_LENGTH = 160;
const URL_FIELD_MAX_LENGTH = 300;
const CONTROL_CHARS = /[\p{Cc}]/gu;

export interface AttributionTouch {
  /** Traffic source: utm_source, the external referrer host, or "direct". */
  source: string;
  /** Traffic medium: utm_medium, "referral", or "direct". */
  medium: string;
  campaign?: string;
  term?: string;
  content?: string;
  /** Ad-platform click id value, when one was present. */
  clickId?: string;
  /** Which click id parameter the value came from (gclid, fbclid, …). */
  clickIdType?: string;
  /** External referrer origin + path, query string stripped. */
  referrer?: string;
  /** Landing pathname, query string stripped. */
  landingPage?: string;
  capturedAt: string;
}

export interface Attribution {
  first: AttributionTouch;
  last: AttributionTouch;
}

/** Flattened shape sent to the API on registration. */
export interface SignupAttribution extends AttributionTouch {
  firstSource?: string;
  firstMedium?: string;
  firstCampaign?: string;
  firstLandingPage?: string;
  firstCapturedAt?: string;
}

function clean(
  value: string | null | undefined,
  maxLength = SHORT_FIELD_MAX_LENGTH,
): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function normalizeReferrer(
  referrer: string,
  currentHostname: string,
): { host: string; url: string } | null {
  if (!referrer) return null;

  try {
    const url = new URL(referrer);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.hostname.toLowerCase() === currentHostname.toLowerCase()) return null;

    return {
      host: url.hostname.replace(/^www\./i, '').slice(0, SHORT_FIELD_MAX_LENGTH),
      url: `${url.origin}${url.pathname}`.slice(0, URL_FIELD_MAX_LENGTH),
    };
  } catch {
    return null;
  }
}

function readCampaign(search: string): {
  utm: Partial<Record<(typeof UTM_PARAM_KEYS)[number], string>>;
  clickId?: string;
  clickIdType?: string;
} {
  const params = new URLSearchParams(search);
  const utm: Partial<Record<(typeof UTM_PARAM_KEYS)[number], string>> = {};

  for (const key of UTM_PARAM_KEYS) {
    const value = clean(params.get(key));
    if (value) utm[key] = value;
  }

  for (const key of CLICK_ID_PARAM_KEYS) {
    const value = clean(params.get(key), URL_FIELD_MAX_LENGTH);
    if (value) return { utm, clickId: value, clickIdType: key };
  }

  return { utm };
}

export interface BuildTouchInput {
  search: string;
  referrer: string;
  pathname: string;
  currentHostname: string;
  now?: Date;
}

/**
 * Builds a touch from the current URL. Returns `hasCampaign: false` for plain
 * internal navigation, which lets the caller avoid overwriting a stored touch.
 */
export function buildAttributionTouch(input: BuildTouchInput): {
  touch: AttributionTouch;
  hasCampaign: boolean;
} {
  const { utm, clickId, clickIdType } = readCampaign(input.search);
  const externalReferrer = normalizeReferrer(input.referrer, input.currentHostname);
  const hasCampaign = Object.keys(utm).length > 0 || Boolean(clickId);

  const source = utm.utm_source ?? externalReferrer?.host ?? 'direct';
  const medium = utm.utm_medium ?? (externalReferrer ? 'referral' : 'direct');

  return {
    hasCampaign,
    touch: {
      source,
      medium,
      campaign: utm.utm_campaign,
      term: utm.utm_term,
      content: utm.utm_content,
      clickId,
      clickIdType,
      referrer: externalReferrer?.url,
      landingPage: clean(input.pathname, URL_FIELD_MAX_LENGTH),
      capturedAt: (input.now ?? new Date()).toISOString(),
    },
  };
}

function sanitizeTouch(value: unknown): AttributionTouch | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;

  const source = typeof record.source === 'string' ? clean(record.source) : undefined;
  const medium = typeof record.medium === 'string' ? clean(record.medium) : undefined;
  if (!source || !medium) return null;

  const capturedAt =
    typeof record.capturedAt === 'string' && !Number.isNaN(Date.parse(record.capturedAt))
      ? record.capturedAt
      : new Date().toISOString();

  return {
    source,
    medium,
    campaign: typeof record.campaign === 'string' ? clean(record.campaign) : undefined,
    term: typeof record.term === 'string' ? clean(record.term) : undefined,
    content: typeof record.content === 'string' ? clean(record.content) : undefined,
    clickId:
      typeof record.clickId === 'string' ? clean(record.clickId, URL_FIELD_MAX_LENGTH) : undefined,
    clickIdType: typeof record.clickIdType === 'string' ? clean(record.clickIdType) : undefined,
    referrer:
      typeof record.referrer === 'string'
        ? clean(record.referrer, URL_FIELD_MAX_LENGTH)
        : undefined,
    landingPage:
      typeof record.landingPage === 'string'
        ? clean(record.landingPage, URL_FIELD_MAX_LENGTH)
        : undefined,
    capturedAt,
  };
}

/** Parses a cookie value, discarding anything that does not match the shape. */
export function parseAttribution(raw: string | null | undefined): Attribution | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;

    const record = parsed as Record<string, unknown>;
    const first = sanitizeTouch(record.first);
    const last = sanitizeTouch(record.last);
    if (!first || !last) return null;

    return { first, last };
  } catch {
    return null;
  }
}

function sharedCookieDomain(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const hostname = window.location.hostname;
  // Browsers reject Domain=localhost, so keep local dev cookies host-only.
  if (hostname === 'localhost' || !hostname.includes('.')) return undefined;

  // Pass the host explicitly: getAppDomain() only inspects requestHost and
  // would otherwise fall back to the production env value.
  const appDomain = getAppDomain(hostname);
  if (hostname === appDomain || hostname.endsWith(`.${appDomain}`)) {
    return `.${appDomain}`;
  }
  return undefined;
}

function writeAttributionCookie(attribution: Attribution): void {
  if (typeof document === 'undefined') return;

  const domain = sharedCookieDomain();
  const domainPart = domain ? `; Domain=${domain}` : '';
  const securePart = window.location.protocol === 'https:' ? '; Secure' : '';
  const maxAge = ATTRIBUTION_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  const value = encodeURIComponent(JSON.stringify(attribution));

  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is not widely supported yet
  document.cookie = `${ATTRIBUTION_COOKIE_NAME}=${value}; path=/${domainPart}; max-age=${maxAge}; SameSite=Lax${securePart}`;
}

export function readAttribution(): Attribution | null {
  if (typeof document === 'undefined') return null;

  const prefix = `${ATTRIBUTION_COOKIE_NAME}=`;
  const entry = document.cookie.split('; ').find((cookie) => cookie.startsWith(prefix));
  if (!entry) return null;

  return parseAttribution(entry.slice(prefix.length));
}

/**
 * Captures the current campaign and persists it. A new campaign link updates
 * the last touch while the first touch — the one that discovered us — is kept.
 * Plain internal navigation never overwrites stored attribution.
 */
export function captureAttribution(): Attribution | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  const existing = readAttribution();
  const { touch, hasCampaign } = buildAttributionTouch({
    search: window.location.search,
    referrer: document.referrer,
    pathname: window.location.pathname,
    currentHostname: window.location.hostname,
  });

  if (existing && !hasCampaign) return existing;

  const next: Attribution = existing
    ? { first: existing.first, last: touch }
    : { first: touch, last: touch };

  try {
    writeAttributionCookie(next);
  } catch {
    // Private mode / blocked storage: keep the in-memory value for this page.
  }

  return next;
}

/** Attribution payload attached to registration requests. */
export function toSignupAttribution(attribution: Attribution): SignupAttribution {
  const { first, last } = attribution;
  const payload: SignupAttribution = { ...last };

  if (first.capturedAt !== last.capturedAt) {
    payload.firstSource = first.source;
    payload.firstMedium = first.medium;
    payload.firstCampaign = first.campaign;
    payload.firstLandingPage = first.landingPage;
    payload.firstCapturedAt = first.capturedAt;
  }

  return payload;
}

/** Attribution payload attached to registration requests. */
export function readSignupAttribution(): SignupAttribution | null {
  const attribution = readAttribution();
  return attribution ? toSignupAttribution(attribution) : null;
}

/** Flat string properties attached to every PostHog event. */
export function attributionEventProperties(
  attribution: Attribution | null | undefined,
): Record<string, string> {
  if (!attribution) return {};

  const { first, last } = attribution;
  const properties: Record<string, string> = {
    signup_source: last.source,
    signup_medium: last.medium,
  };

  if (last.campaign) properties.utm_campaign = last.campaign;
  if (last.term) properties.utm_term = last.term;
  if (last.content) properties.utm_content = last.content;
  if (last.clickIdType) properties.click_id_type = last.clickIdType;
  if (last.clickId) properties.click_id = last.clickId;
  if (last.referrer) properties.referrer = last.referrer;
  if (last.landingPage) properties.landing_page = last.landingPage;

  const lastUtmSource = last.source !== 'direct' ? last.source : undefined;
  if (lastUtmSource) properties.utm_source = lastUtmSource;

  if (first.capturedAt !== last.capturedAt) {
    properties.first_touch_source = first.source;
    properties.first_touch_medium = first.medium;
    if (first.campaign) properties.first_touch_campaign = first.campaign;
    if (first.landingPage) properties.first_touch_landing_page = first.landingPage;
  }

  return properties;
}
