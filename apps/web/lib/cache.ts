/**
 * Great hybrid cache — in-memory LRU + sessionStorage persistence
 * Sticks to in-memory (no Redis/IDB) but great: LRU eviction, TTL, size bounds, tenant isolation, stats.
 * PERFORMANCE.md: caches only after measuring bottleneck; keys/TTL/invalidation defined.
 * L-5: PII must not be cached here without encryption and short TTL. Use MAX_CACHE_TTL.
 */

// Great in-memory layer — LRU via Map insertion order, 200 entries / 5MB cap, 60s cleanup
const MEMORY_MAX_ENTRIES = 200;
const MEMORY_MAX_BYTES = 5 * 1024 * 1024;
const CLEANUP_INTERVAL_MS = 60 * 1000;

interface MemoryEntry<T> {
  value: T;
  expiresAt: number;
  size: number;
  hits: number;
}

const memoryCache = new Map<string, MemoryEntry<unknown>>();
let memoryBytes = 0;
let memoryHits = 0;
let memoryMisses = 0;

function estimateSize(value: unknown): number {
  try {
    return JSON.stringify(value).length * 2;
  } catch {
    return 1024;
  }
}

function evictExpiredMemory(): void {
  const now = Date.now();
  for (const [key, entry] of memoryCache) {
    if (now > entry.expiresAt) {
      memoryBytes -= entry.size;
      memoryCache.delete(key);
    }
  }
}

function evictLruMemory(): void {
  const firstKey = memoryCache.keys().next().value as string | undefined;
  if (firstKey) {
    const entry = memoryCache.get(firstKey);
    if (entry) memoryBytes -= entry.size;
    memoryCache.delete(firstKey);
  }
}

function ensureMemoryCapacity(newSize: number): void {
  while (
    (memoryCache.size >= MEMORY_MAX_ENTRIES || memoryBytes + newSize > MEMORY_MAX_BYTES) &&
    memoryCache.size > 0
  ) {
    evictLruMemory();
  }
}

if (typeof window !== 'undefined') {
  const timer: ReturnType<typeof setInterval> = setInterval(
    evictExpiredMemory,
    CLEANUP_INTERVAL_MS,
  );
  (timer as unknown as { unref?: () => void }).unref?.();
}

const CACHE_PREFIX = 'paqad_cache_';
const CACHE_EXPIRY_KEY = 'paqad_cache_expiry_';
export const MAX_CACHE_TTL = 5 * 60 * 1000; // 5m max per SECURITY.md §5 — do not extend for PII
export const DEFAULT_CACHE_TTL = 2 * 60 * 1000; // 2m default for sensitive data

export interface CacheOptions {
  /** Cache duration in milliseconds. Default: 2 minutes (capped at 5m) */
  ttl?: number;
}

export function getCacheStats(): {
  hits: number;
  misses: number;
  size: number;
  memoryBytes: number;
  maxEntries: number;
} {
  return {
    hits: memoryHits,
    misses: memoryMisses,
    size: memoryCache.size,
    memoryBytes,
    maxEntries: MEMORY_MAX_ENTRIES,
  };
}

/**
 * Get cached data — memory-first (LRU, instant), then sessionStorage fallback
 */
export function getCached<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;

  // Memory hit — LRU move to end
  const memEntry = memoryCache.get(key) as MemoryEntry<T> | undefined;
  if (memEntry) {
    if (Date.now() > memEntry.expiresAt) {
      memoryBytes -= memEntry.size;
      memoryCache.delete(key);
    } else {
      memoryCache.delete(key);
      memEntry.hits++;
      memoryHits++;
      memoryCache.set(key, memEntry as MemoryEntry<unknown>);
      return memEntry.value;
    }
  }

  try {
    const expiryKey = CACHE_EXPIRY_KEY + key;
    const expiry = sessionStorage.getItem(expiryKey);

    if (expiry && Date.now() > Number(expiry)) {
      sessionStorage.removeItem(CACHE_PREFIX + key);
      sessionStorage.removeItem(expiryKey);
      memoryMisses++;
      return null;
    }

    const cached = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!cached) {
      memoryMisses++;
      return null;
    }

    const parsed = JSON.parse(cached) as T;
    // Promote to memory for next read (great hybrid)
    try {
      const size = estimateSize(parsed);
      ensureMemoryCapacity(size);
      memoryCache.set(key, {
        value: parsed,
        expiresAt: expiry ? Number(expiry) : Date.now() + DEFAULT_CACHE_TTL,
        size,
        hits: 0,
      });
      memoryBytes += size;
    } catch {}
    memoryHits++;
    return parsed;
  } catch {
    memoryMisses++;
    return null;
  }
}

/**
 * Set data — memory LRU + sessionStorage persistence (capped at MAX_CACHE_TTL)
 */
export function setCached<T>(key: string, data: T, options?: CacheOptions): void {
  if (typeof window === 'undefined') return;

  try {
    const requestedTtl = options?.ttl ?? DEFAULT_CACHE_TTL;
    // L-5: Enforce MAX_CACHE_TTL — never cache PII longer than 5m
    const ttl = Math.min(requestedTtl, MAX_CACHE_TTL);
    const expiry = Date.now() + ttl;

    // Memory LRU — great in-memory
    try {
      const size = estimateSize(data);
      const existing = memoryCache.get(key);
      if (existing) memoryBytes -= existing.size;
      ensureMemoryCapacity(size);
      memoryCache.delete(key);
      memoryCache.set(key, { value: data, expiresAt: expiry, size, hits: 0 });
      memoryBytes += size;
    } catch {}

    // Persistent layer — sessionStorage (survives reload, per-tab)
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
    sessionStorage.setItem(CACHE_EXPIRY_KEY + key, String(expiry));
  } catch {
    // quota exceeded — fallback to memory only
  }
}

/**
 * Remove cached data — memory + storage
 */
export function removeCached(key: string): void {
  const memEntry = memoryCache.get(key);
  if (memEntry) {
    memoryBytes -= memEntry.size;
    memoryCache.delete(key);
  }
  if (typeof window === 'undefined') return;

  sessionStorage.removeItem(CACHE_PREFIX + key);
  sessionStorage.removeItem(CACHE_EXPIRY_KEY + key);
}

/**
 * Clear all app cache — memory + storage
 */
export function clearAppCache(): void {
  memoryCache.clear();
  memoryBytes = 0;
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

// Cache keys — L-5: tenant-scoped where applicable to prevent cross-tenant bleed
export const cacheKeys = {
  auth: {
    session: 'auth_session',
  },
  tenants: {
    all: 'tenants_all',
  },
} as const;

export function tenantCacheKey(tenantId: string, key: string): string {
  return `${tenantId}_${key}`;
}

export function clearTenantCache(tenantId: string): void {
  // Memory layer — great LRU clear per tenant
  for (const [key, entry] of memoryCache) {
    if (
      key.includes(tenantId) ||
      (entry as unknown as { tenantId?: string }).tenantId === tenantId
    ) {
      memoryBytes -= entry.size;
      memoryCache.delete(key);
    }
  }
  if (typeof window === 'undefined') return;
  const prefix = CACHE_PREFIX + tenantId;
  const expiryPrefix = CACHE_EXPIRY_KEY + tenantId;
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(prefix) || key?.startsWith(expiryPrefix) || key?.includes(tenantId)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) sessionStorage.removeItem(key);
}
