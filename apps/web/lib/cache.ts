/**
 * Session-based cache for API responses.
 * Data persists for the browser session (until tab/window closes).
 * This provides instant page loads while maintaining GDPR/NDPR compliance.
 */

const CACHE_PREFIX = 'paqad_cache_';
const CACHE_EXPIRY_KEY = 'paqad_cache_expiry_';

export interface CacheOptions {
  /** Cache duration in milliseconds. Default: 5 minutes */
  ttl?: number;
}

/**
 * Get cached data from sessionStorage
 */
export function getCached<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;

  try {
    const expiryKey = CACHE_EXPIRY_KEY + key;
    const expiry = sessionStorage.getItem(expiryKey);

    if (expiry && Date.now() > Number(expiry)) {
      sessionStorage.removeItem(CACHE_PREFIX + key);
      sessionStorage.removeItem(expiryKey);
      return null;
    }

    const cached = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!cached) return null;

    return JSON.parse(cached) as T;
  } catch {
    return null;
  }
}

/**
 * Set data in sessionStorage cache
 */
export function setCached<T>(key: string, data: T, options?: CacheOptions): void {
  if (typeof window === 'undefined') return;

  try {
    const ttl = options?.ttl ?? 5 * 60 * 1000; // 5 minutes default
    const expiry = Date.now() + ttl;

    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
    sessionStorage.setItem(CACHE_EXPIRY_KEY + key, String(expiry));
  } catch {
    // sessionStorage quota exceeded or not available - silently fail
  }
}

/**
 * Remove cached data
 */
export function removeCached(key: string): void {
  if (typeof window === 'undefined') return;

  sessionStorage.removeItem(CACHE_PREFIX + key);
  sessionStorage.removeItem(CACHE_EXPIRY_KEY + key);
}

/**
 * Clear all app cache
 */
export function clearAppCache(): void {
  if (typeof window === 'undefined') return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX) || key?.startsWith(CACHE_EXPIRY_KEY)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    sessionStorage.removeItem(key);
  }
}

// Cache keys
export const cacheKeys = {
  auth: {
    session: 'auth_session',
  },
  tenants: {
    all: 'tenants_all',
  },
} as const;
