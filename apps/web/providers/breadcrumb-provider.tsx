'use client';

import { usePathname } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  type BreadcrumbTailState,
  clearBreadcrumbTailForPathname,
  EMPTY_BREADCRUMB_TAIL_STATE,
  getBreadcrumbTailLabelForPathname,
  setBreadcrumbTailForPathname,
} from './breadcrumb-tail-state';

type BreadcrumbContextValue = {
  tailLabel: string | null;
  setTailLabel: (pathname: string, label: string | null) => void;
  clearTailLabel: (pathname: string) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [tailState, setTailState] = useState<BreadcrumbTailState>(EMPTY_BREADCRUMB_TAIL_STATE);

  const setTailLabel = useCallback((targetPathname: string, label: string | null) => {
    setTailState((currentState) => {
      if (currentState.pathname === targetPathname && currentState.label === label) {
        return currentState;
      }

      return setBreadcrumbTailForPathname(targetPathname, label);
    });
  }, []);

  const clearTailLabel = useCallback((targetPathname: string) => {
    setTailState((currentState) => clearBreadcrumbTailForPathname(currentState, targetPathname));
  }, []);

  const tailLabel = useMemo(
    () => getBreadcrumbTailLabelForPathname(tailState, pathname),
    [pathname, tailState],
  );
  const value = useMemo(
    () => ({ tailLabel, setTailLabel, clearTailLabel }),
    [clearTailLabel, setTailLabel, tailLabel],
  );

  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

export function useBreadcrumbContext() {
  return useContext(BreadcrumbContext);
}

export function useBreadcrumbTail(label: string | null | undefined) {
  const context = useBreadcrumbContext();
  const pathname = usePathname();

  useEffect(() => {
    if (!context) return;
    context.setTailLabel(pathname, label ?? null);
    return () => context.clearTailLabel(pathname);
  }, [context, label, pathname]);
}
