import type { ReactNode } from 'react';

export function PageActions({ children }: { children?: ReactNode }) {
  if (!children) return null;

  return (
    <div className="flex w-full justify-stretch sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">
      {children}
    </div>
  );
}
