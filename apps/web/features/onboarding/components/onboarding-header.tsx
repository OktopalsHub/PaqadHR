'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { PaqadLogo } from '@/components/paqad-logo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePrefetchBillingOverview } from '@/hooks/queries/use-billing';
import { formatWorkspaceName } from '@/lib/format-name';
import { tenantRoot } from '@/lib/navigation/tenant-routes';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/providers/tenant-provider';

export function OnboardingHeader() {
  const { logout, isAuthenticated, isLoading: authLoading } = useAuth();
  const { tenants, tenant, setTenantId, isLoading: tenantLoading } = useTenant();
  const prefetchBilling = usePrefetchBillingOverview();

  useEffect(() => {
    if (tenant?.id) prefetchBilling();
  }, [tenant?.id, prefetchBilling]);

  const isLoading = authLoading || tenantLoading;

  const logoHref = useMemo(() => {
    if (!isAuthenticated || !tenants.length) return '/';
    // Prefer an already-active workspace over the unpaid one being onboarded
    const fallback = tenants.find((t) => t.isActive) ?? tenants[0] ?? tenant;
    if (!fallback?.slug) return '/';
    try {
      return tenantRoot(fallback.slug);
    } catch {
      return `/${fallback.slug}`;
    }
  }, [isAuthenticated, tenants, tenant]);

  const isExternalLogoHref = logoHref.startsWith('http');

  const LogoLink = isExternalLogoHref ? (
    <a
      href={logoHref}
      aria-label="Go to dashboard"
      className="inline-flex items-center gap-2.5 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.26)]"
    >
      <PaqadLogo showWordmark={false} className="size-7 sm:size-8" />
      <span className="text-sm font-semibold tracking-[-0.03em] text-slate-900 sm:hidden">
        Paqad HR
      </span>
    </a>
  ) : (
    <Link
      href={logoHref}
      aria-label={isAuthenticated ? 'Go to dashboard' : 'Paqad home'}
      className="inline-flex items-center gap-2.5 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.26)]"
    >
      <PaqadLogo showWordmark={false} className="size-7 sm:size-8" />
      <span className="text-sm font-semibold tracking-[-0.03em] text-slate-900 sm:hidden">
        Paqad HR
      </span>
    </Link>
  );

  return (
    <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/70 bg-white/82 px-4 py-3 shadow-[0_30px_80px_-56px_rgba(15,23,42,0.34)] backdrop-blur-xl sm:min-h-[72px] sm:px-5 sm:py-0">
      <div className="min-w-0 flex items-center gap-3 sm:gap-4">
        {LogoLink}
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
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {tenants.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 rounded-[16px] border border-slate-200 bg-white/70 px-3 text-sm font-semibold text-slate-700 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.28)] hover:bg-white"
                >
                  <span className="max-w-[14ch] truncate">
                    {formatWorkspaceName(tenant?.name ?? 'Workspaces')}
                  </span>
                  <span className="ml-1 hidden text-slate-400 sm:inline">· Switch</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-xl">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Switch workspace
                </DropdownMenuLabel>
                {tenants.map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    onClick={() => setTenantId(item.id)}
                    className="gap-2"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {formatWorkspaceName(item.name)}
                    </span>
                    {item.id === tenant?.id ? (
                      <span className="text-xs text-primary">Current</span>
                    ) : null}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href={logoHref} className="gap-2">
                    Go to dashboard
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : tenants.length === 1 && tenant?.slug ? (
            <Button
              variant="outline"
              className="h-10 rounded-[16px] border border-slate-200 bg-white/70 px-4 text-sm font-semibold text-slate-700 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.28)] hover:bg-white"
              asChild
            >
              <a href={logoHref}>Go to dashboard</a>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            onClick={logout}
            className="h-10 rounded-[16px] border border-slate-200 bg-white/70 px-4 text-sm font-semibold text-slate-700 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.28)] hover:bg-white"
          >
            Sign out
          </Button>
        </div>
      ) : null}
    </div>
  );
}
