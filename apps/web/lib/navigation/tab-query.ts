/** Query params owned by a specific tab — stripped when navigating away. */
const TAB_OWNED_PARAMS: Record<string, string[]> = {
  billing: ['billing'],
  integrations: ['slack_setup', 'integration_id'],
};

export function buildTabUrl(
  pathname: string,
  searchParams: URLSearchParams,
  tab: string,
  options?: { previousTab?: string },
): string {
  const params = new URLSearchParams(searchParams.toString());
  params.set('tab', tab);

  if (options?.previousTab) {
    for (const key of TAB_OWNED_PARAMS[options.previousTab] ?? []) {
      params.delete(key);
    }
  }

  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function readTabParam<T extends string>(
  search: string,
  isValid: (tab: string | null) => tab is T,
  fallback: T,
): T {
  const tab = new URLSearchParams(search).get('tab');
  return isValid(tab) ? tab : fallback;
}

/** Update ?tab= without triggering an App Router navigation (avoids Suspense remount). */
export function replaceTabInUrl(
  pathname: string,
  tab: string,
  options?: { previousTab?: string },
): void {
  const params = new URLSearchParams(window.location.search);
  const href = buildTabUrl(pathname, params, tab, options);
  window.history.replaceState(null, '', href);
}
