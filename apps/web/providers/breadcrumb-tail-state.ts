export type BreadcrumbTailState = {
  pathname: string | null;
  label: string | null;
};

export const EMPTY_BREADCRUMB_TAIL_STATE: BreadcrumbTailState = {
  pathname: null,
  label: null,
};

export function setBreadcrumbTailForPathname(
  pathname: string,
  label: string | null,
): BreadcrumbTailState {
  return { pathname, label };
}

export function clearBreadcrumbTailForPathname(
  state: BreadcrumbTailState,
  pathname: string,
): BreadcrumbTailState {
  if (state.pathname !== pathname) {
    return state;
  }

  return EMPTY_BREADCRUMB_TAIL_STATE;
}

export function getBreadcrumbTailLabelForPathname(
  state: BreadcrumbTailState,
  pathname: string,
): string | null {
  return state.pathname === pathname ? state.label : null;
}
