type Listener = () => void;

let activeRequestCount = 0;
const listeners = new Set<Listener>();

function notifyListeners() {
  for (const listener of listeners) listener();
}

export function beginNetworkActivity(): () => void {
  activeRequestCount += 1;
  notifyListeners();

  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    activeRequestCount = Math.max(0, activeRequestCount - 1);
    notifyListeners();
  };
}

export function getNetworkActivitySnapshot(): boolean {
  return activeRequestCount > 0;
}

export function subscribeToNetworkActivity(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
