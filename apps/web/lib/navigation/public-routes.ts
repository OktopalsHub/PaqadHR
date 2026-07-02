/** Routes that never need an auth/session API probe on first paint. */
export function skipsSessionBootstrap(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/terms' ||
    pathname === '/privacy' ||
    /^\/[^/]+\/careers\/?$/.test(pathname)
  );
}
