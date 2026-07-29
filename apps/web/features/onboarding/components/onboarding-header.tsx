'use client';

import Link from 'next/link';
import { PaqadLogo } from '@/components/paqad-logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

export function OnboardingHeader() {
  const { logout, isAuthenticated, isLoading } = useAuth();

  return (
    <div className="flex min-h-[68px] items-center justify-between rounded-[24px] border border-white/70 bg-white/82 px-4 shadow-[0_30px_80px_-56px_rgba(15,23,42,0.34)] backdrop-blur-xl sm:min-h-[72px] sm:px-5">
      <div className="flex items-center gap-3 sm:gap-4">
        <Link
          href="/"
          aria-label="Paqad home"
          className="inline-flex rounded-full border border-white/70 bg-white/90 px-3 py-1.5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.26)]"
        >
          <PaqadLogo className="h-7 w-auto sm:h-8" />
        </Link>
        <div className="hidden sm:block">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Workspace setup
          </p>
          <p className="text-sm font-medium text-slate-600">
            Finish onboarding and launch your team workspace.
          </p>
        </div>
      </div>

      {!isLoading && isAuthenticated ? (
        <Button
          type="button"
          variant="ghost"
          onClick={logout}
          className="h-10 rounded-[16px] border border-slate-200 bg-white/70 px-4 text-sm font-semibold text-slate-700 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.28)] hover:bg-white"
        >
          Sign out
        </Button>
      ) : null}
    </div>
  );
}
