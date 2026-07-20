'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingBlock } from '@/components/loading-block';
import { useAuth } from '@/hooks/use-auth';
import { authPageUrl, subscribePageUrl } from '@/lib/navigation/tenant-routes';
import { useTenant } from '@/providers/tenant-provider';

export function SubscribeGate({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const workspaceSlug = searchParams.get('workspace');
  const isWelcome = searchParams.get('welcome') === '1';
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const {
    tenants,
    tenant,
    setTenantId,
    isLoading: tenantLoading,
    hasResolvedTenants,
  } = useTenant();

  const isLoading = authLoading || (isAuthenticated && tenantLoading);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      window.location.assign(
        authPageUrl(
          '/signin',
          subscribePageUrl({
            workspace: workspaceSlug ?? undefined,
            welcome: isWelcome || undefined,
          }),
        ),
      );
    }
  }, [authLoading, isAuthenticated, workspaceSlug, isWelcome]);

  useEffect(() => {
    if (!workspaceSlug || !tenants.length) return;
    const match = tenants.find((item) => item.slug === workspaceSlug);
    if (match && match.id !== tenant?.id) {
      setTenantId(match.id);
    }
  }, [workspaceSlug, tenants, tenant?.id, setTenantId]);

  if (isLoading || !hasResolvedTenants) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <LoadingBlock />
      </div>
    );
  }

  if (!isAuthenticated || tenants.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <LoadingBlock />
      </div>
    );
  }

  return <>{children}</>;
}
