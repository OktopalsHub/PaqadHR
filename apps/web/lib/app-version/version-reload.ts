export const VERSION_RELOAD_STORAGE_KEY = 'paqadhr-version-reload';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function getSessionStorage(): StorageLike | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

/** Fail closed: storage errors mean do not reload. */
export function shouldReloadForVersion(
  remoteBuildId: string,
  storage: StorageLike | null = getSessionStorage(),
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(VERSION_RELOAD_STORAGE_KEY) !== remoteBuildId;
  } catch {
    return false;
  }
}

/** Returns true only when the marker was stored successfully. */
export function markVersionReloadAttempted(
  remoteBuildId: string,
  storage: StorageLike | null = getSessionStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(VERSION_RELOAD_STORAGE_KEY, remoteBuildId);
    return true;
  } catch {
    return false;
  }
}
