const STORAGE_KEY = 'paqadhr.recruitment.askEmailOnMove';

export function readAskEmailOnMove(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function writeAskEmailOnMove(value: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
    window.dispatchEvent(new Event(STORAGE_KEY));
  } catch {}
}

export function subscribeAskEmailOnMove(onChange: () => void): () => void {
  window.addEventListener(STORAGE_KEY, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(STORAGE_KEY, onChange);
    window.removeEventListener('storage', onChange);
  };
}
