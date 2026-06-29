export function buildTabUrl(pathname: string, searchParams: URLSearchParams, tab: string): string {
  const params = new URLSearchParams(searchParams.toString());
  params.set('tab', tab);
  return `${pathname}?${params.toString()}`;
}
