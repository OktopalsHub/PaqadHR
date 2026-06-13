"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/providers/tenant-provider";
import { markOnboardingComplete } from "@/lib/session";

/** Skip setup when the user already has a workspace. */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { tenants, isLoading } = useTenant();

  useEffect(() => {
    if (isLoading) return;
    if (tenants.length > 0) {
      markOnboardingComplete();
      router.replace("/app");
    }
  }, [isLoading, tenants.length, router]);

  if (isLoading || tenants.length > 0) {
    return null;
  }

  return <>{children}</>;
}
