"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type BreadcrumbContextValue = {
  tailLabel: string | null;
  setTailLabel: (label: string | null) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [tailLabel, setTailLabelState] = useState<string | null>(null);

  const setTailLabel = useCallback((label: string | null) => {
    setTailLabelState(label);
  }, []);

  useEffect(() => {
    setTailLabelState(null);
  }, [pathname]);

  const value = useMemo(
    () => ({ tailLabel, setTailLabel }),
    [tailLabel, setTailLabel],
  );

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbContext() {
  return useContext(BreadcrumbContext);
}

export function useBreadcrumbTail(label: string | null | undefined) {
  const context = useBreadcrumbContext();

  useEffect(() => {
    if (!context) return;
    context.setTailLabel(label ?? null);
    return () => context.setTailLabel(null);
  }, [context, label]);
}
