"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/providers/tenant-provider";
import { markOnboardingComplete } from "@/lib/session";

/** Redirect to workspace setup when the user has no tenant yet. */
export function AppGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { tenants, isLoading: tenantLoading } = useTenant();

  useEffect(() => {
    if (authLoading || tenantLoading) return;
    if (user?.needsOnboarding && tenants.length === 0) {
      router.replace("/onboarding");
      return;
    }
    if (tenants.length > 0 && user?.needsOnboarding) {
      markOnboardingComplete();
    }
  }, [authLoading, tenantLoading, user, tenants.length, router]);

  if (authLoading || tenantLoading) {
    return null;
  }

  if (user?.needsOnboarding && tenants.length === 0) {
    return null;
  }

  return <>{children}</>;
}
