import Link from 'next/link';
import type { ReactNode } from 'react';
import { PaqadLogo } from '@/components/paqad-logo';
import { ForceLightTheme } from '@/providers/force-light-theme';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <ForceLightTheme>
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="hidden flex-col justify-between border-r border-border bg-background p-12 lg:flex">
          <Link href="/" aria-label="Paqad home">
            <PaqadLogo className="h-9 w-auto" />
          </Link>
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.02em]">
              Get better at people operations with Paqad.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              Hire, pay, and support your team in a workspace built for focus.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">14 days free · No card required</p>
        </div>
        <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
          <div className="mx-auto mb-8 w-full max-w-md lg:hidden">
            <Link href="/" aria-label="Paqad home" className="inline-flex">
              <PaqadLogo className="h-8 w-auto" />
            </Link>
          </div>
          <div className="mx-auto w-full max-w-md">{children}</div>
        </div>
      </div>
    </ForceLightTheme>
  );
}
