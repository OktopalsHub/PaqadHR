import type { ReactNode } from 'react';

export function PageActions({ children }: { children?: ReactNode }) {
  if (!children) return null;

  return <div className="flex justify-end">{children}</div>;
}
