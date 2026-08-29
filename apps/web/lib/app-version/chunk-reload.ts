export const CHUNK_RELOAD_STORAGE_KEY = 'paqadhr-chunk-reload';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const CHUNK_ERROR_PATTERNS = [
  /ChunkLoadError/i,
  /Loading chunk \d+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Loading CSS chunk \d+ failed/i,
  /Importing a module script failed/i,
];

function getSessionStorage(): StorageLike | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const name = error instanceof Error ? error.name : '';
  const combined = `${name} ${message}`.trim();
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(combined));
}

/** Fail closed: storage errors mean do not reload. */
export function shouldReloadForChunkError(
  buildId: string,
  storage: StorageLike | null = getSessionStorage(),
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(CHUNK_RELOAD_STORAGE_KEY) !== buildId;
  } catch {
    return false;
  }
}

/** Returns true only when the marker was stored successfully. */
export function markChunkReloadAttempted(
  buildId: string,
  storage: StorageLike | null = getSessionStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(CHUNK_RELOAD_STORAGE_KEY, buildId);
    return true;
  } catch {
    return false;
  }
}
