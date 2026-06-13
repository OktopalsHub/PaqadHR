"use client";

import { PageHeader } from "@/components/page-header";
import { LoadingBlock } from "@/components/loading-block";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { useBillingStatus } from "@/hooks/queries/use-billing";
import { useTenant } from "@/providers/tenant-provider";

export function SettingsPage() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { data: billing, isLoading, isError, error } = useBillingStatus();

  if (isLoading) return <LoadingBlock />;

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load settings</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : "Something went wrong"}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Workspace profile and billing overview."
      />

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-sm font-medium">Profile</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{user?.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Role</dt>
            <dd className="capitalize">{user?.role?.replace("_", " ")}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-sm font-medium">Workspace</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{tenant?.name ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Slug</dt>
            <dd>{tenant?.slug ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-sm font-medium">Billing</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Mode</dt>
            <dd className="capitalize">{billing?.billingMode}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Card payments</dt>
            <dd>
              <Badge variant={billing?.paymentsEnabled ? "default" : "secondary"}>
                {billing?.paymentsEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </dd>
          </div>
          {billing?.subscription ? (
            <>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Plan</dt>
                <dd className="capitalize">{billing.subscription.plan}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="capitalize">{billing.subscription.status}</dd>
              </div>
              {billing.subscription.daysRemaining != null ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Trial remaining</dt>
                  <dd>{billing.subscription.daysRemaining} days</dd>
                </div>
              ) : null}
            </>
          ) : null}
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          Billing is manual during beta. Contact your admin to extend trial or
          activate a paid plan.
        </p>
      </section>
    </div>
  );
}
