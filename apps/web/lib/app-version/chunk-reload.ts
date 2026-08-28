export const CHUNK_RELOAD_STORAGE_KEY = 'paqadhr-chunk-reload';

const CHUNK_ERROR_PATTERNS = [
  /ChunkLoadError/i,
  /Loading chunk \d+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Loading CSS chunk \d+ failed/i,
  /Importing a module script failed/i,
];

export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const name = error instanceof Error ? error.name : '';
  const combined = `${name} ${message}`.trim();
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(combined));
}

export function shouldReloadForChunkError(buildId: string): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY) !== buildId;
}

export function markChunkReloadAttempted(buildId: string): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, buildId);
}
