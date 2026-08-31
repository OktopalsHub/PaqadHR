'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingSpinner } from '@/components/loading-block';
import { billingOverviewQueryOptions } from '@/hooks/queries/use-billing';
import { useAuth } from '@/hooks/use-auth';
import { authPageUrl, subscribePagePath } from '@/lib/navigation/tenant-routes';
import { useTenant } from '@/providers/tenant-provider';

export function SubscribeGate({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const workspaceSlug = searchParams.get('workspace');
  const isWelcome = searchParams.get('welcome') === '1';
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const {
    tenants,
    tenant,
    selectTenantId,
    isLoading: tenantLoading,
    hasResolvedTenants,
  } = useTenant();
  const queryClient = useQueryClient();

  const isLoading = authLoading || (isAuthenticated && tenantLoading);

  // Intent prefetch: start billing fetch as soon as tenant is known, in parallel with gate render
  useEffect(() => {
    if (!tenant?.id) return;
    void queryClient.prefetchQuery(billingOverviewQueryOptions(tenant.id));
  }, [tenant?.id, queryClient]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      window.location.assign(
        authPageUrl(
          '/signin',
          subscribePagePath({
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
      selectTenantId(match.id);
    }
  }, [workspaceSlug, tenants, tenant?.id, selectTenantId]);

  if (isLoading || !hasResolvedTenants) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated || tenants.length === 0) {
    return <LoadingSpinner />;
  }

  return <>{children}</>;
}
