import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export interface InMemoryCacheEntry<T> {
  value: T;
  expiresAt: number;
  size: number;
  tenantId?: string;
  createdAt: number;
  hits: number;
}

export interface InMemoryCacheOptions {
  maxEntries?: number; // default 5000
  maxMemoryBytes?: number; // default 50MB
  defaultTtlMs?: number; // default 5m
  cleanupIntervalMs?: number; // default 60s
  namespace?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  expirations: number;
  size: number;
  memoryBytes: number;
  maxEntries: number;
  maxMemoryBytes: number;
}

/**
 * Great in-memory cache — LRU + TTL + tenant isolation + size bounds + stats
 * Sticks to in-memory (no Redis) per PERFORMANCE.md: add caches only after measuring.
 * Use for: tenant-scoped lookups, rate-limit fallback, computed rewards, etc.
 * PII must use ttl <= MAX_CACHE_TTL (5m) and tenant-scoped keys.
 */
@Injectable()
export class InMemoryCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(InMemoryCacheService.name);
  private readonly store = new Map<string, InMemoryCacheEntry<unknown>>();
  private readonly maxEntries: number;
  private readonly maxMemoryBytes: number;
  private readonly defaultTtlMs: number;
  private readonly namespace: string;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private expirations = 0;
  private memoryBytes = 0;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options?: InMemoryCacheOptions) {
    this.maxEntries = options?.maxEntries ?? 5000;
    this.maxMemoryBytes = options?.maxMemoryBytes ?? 50 * 1024 * 1024; // 50MB
    this.defaultTtlMs = options?.defaultTtlMs ?? 5 * 60 * 1000;
    this.namespace = options?.namespace ?? 'default';
    const interval = options?.cleanupIntervalMs ?? 60 * 1000;
    if (interval > 0) {
      this.cleanupTimer = setInterval(() => this.evictExpired(), interval);
      this.cleanupTimer.unref?.();
    }
    this.logger.log(
      `InMemoryCache [${this.namespace}] initialized — maxEntries=${this.maxEntries} maxMemory=${(this.maxMemoryBytes / 1024 / 1024).toFixed(1)}MB ttl=${this.defaultTtlMs}ms`,
    );
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.store.clear();
  }

  private estimateSize(value: unknown): number {
    try {
      const json = JSON.stringify(value);
      return json.length * 2; // rough utf16
    } catch {
      return 1024;
    }
  }

  private isExpired(entry: InMemoryCacheEntry<unknown>): boolean {
    return Date.now() > entry.expiresAt;
  }

  private evictExpired(): void {
    let expired = 0;
    for (const [key, entry] of this.store) {
      if (this.isExpired(entry)) {
        this.memoryBytes -= entry.size;
        this.store.delete(key);
        expired++;
        this.expirations++;
      }
    }
    if (expired > 0) this.logger.debug(`Cache [${this.namespace}] expired ${expired} entries`);
  }

  private evictLru(): void {
    const firstKey = this.store.keys().next().value as string | undefined;
    if (firstKey) {
      const entry = this.store.get(firstKey);
      if (entry) this.memoryBytes -= entry.size;
      this.store.delete(firstKey);
      this.evictions++;
    }
  }

  private ensureCapacity(newEntrySize: number): void {
    while (
      (this.store.size >= this.maxEntries ||
        this.memoryBytes + newEntrySize > this.maxMemoryBytes) &&
      this.store.size > 0
    ) {
      this.evictLru();
    }
  }

  set<T>(key: string, value: T, ttlMs?: number, tenantId?: string): void {
    const ttl = ttlMs ?? this.defaultTtlMs;
    // Enforce MAX_CACHE_TTL for PII safety (SECURITY.md §5) — callers with longer TTL get capped
    const effectiveTtl = Math.min(ttl, 5 * 60 * 1000);
    const size = this.estimateSize(value);
    const existing = this.store.get(key);
    if (existing) this.memoryBytes -= existing.size;
    this.ensureCapacity(size);
    // Delete then set to move to end (MRU)
    this.store.delete(key);
    this.store.set(key, {
      value,
      expiresAt: Date.now() + effectiveTtl,
      size,
      tenantId,
      createdAt: Date.now(),
      hits: 0,
    });
    this.memoryBytes += size;
  }

  get<T>(key: string, tenantId?: string): T | undefined {
    const entry = this.store.get(key) as InMemoryCacheEntry<T> | undefined;
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (this.isExpired(entry)) {
      this.memoryBytes -= entry.size;
      this.store.delete(key);
      this.misses++;
      this.expirations++;
      return undefined;
    }
    if (tenantId && entry.tenantId && entry.tenantId !== tenantId) {
      // Tenant isolation — do not return cross-tenant data (BOLA)
      this.misses++;
      return undefined;
    }
    // LRU: move to end
    this.store.delete(key);
    entry.hits++;
    this.hits++;
    this.store.set(key, entry as InMemoryCacheEntry<unknown>);
    return entry.value;
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.memoryBytes -= entry.size;
      this.store.delete(key);
      this.expirations++;
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    const entry = this.store.get(key);
    if (entry) this.memoryBytes -= entry.size;
    return this.store.delete(key);
  }

  clear(tenantId?: string): void {
    if (tenantId) {
      for (const [key, entry] of this.store) {
        if (entry.tenantId === tenantId) {
          this.memoryBytes -= entry.size;
          this.store.delete(key);
        }
      }
      this.logger.log(`Cache [${this.namespace}] cleared tenant ${tenantId}`);
    } else {
      this.store.clear();
      this.memoryBytes = 0;
      this.hits = 0;
      this.misses = 0;
    }
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }

  getStats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      expirations: this.expirations,
      size: this.store.size,
      memoryBytes: this.memoryBytes,
      maxEntries: this.maxEntries,
      maxMemoryBytes: this.maxMemoryBytes,
    };
  }

  // For rate-limit use: atomic increment with TTL
  incrWithTtl(
    key: string,
    windowMs: number,
    tenantId?: string,
  ): { count: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store.get(key) as
      | InMemoryCacheEntry<{ count: number; resetTime: number }>
      | undefined;
    if (!entry || this.isExpired(entry)) {
      if (entry) {
        this.memoryBytes -= entry.size;
        this.store.delete(key);
        this.expirations++;
      }
      const resetTime = now + windowMs;
      const value = { count: 1, resetTime };
      this.set(key, value, windowMs, tenantId);
      return value;
    }
    // Hit — increment and move to MRU
    const value = entry.value as { count: number; resetTime: number };
    value.count += 1;
    // Refresh TTL? For rate-limit, keep original resetTime, not extend
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits++;
    return value;
  }
}
