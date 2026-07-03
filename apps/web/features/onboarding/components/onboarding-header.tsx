'use client';

import { PaqadLogo } from '@/components/paqad-logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

export function OnboardingHeader() {
  const { logout, isAuthenticated, isLoading } = useAuth();

  return (
    <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
      <PaqadLogo showWordmark={false} className="size-8" />
      {!isLoading && isAuthenticated ? (
        <Button type="button" variant="ghost" size="sm" onClick={logout}>
          Sign out
        </Button>
      ) : null}
    </div>
  );
}
