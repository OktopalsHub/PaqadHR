"use client";

import type { ReactNode } from "react";
import { Building2, CreditCard, UserCircle } from "lucide-react";
import { AppPage } from "@/components/app-page";
import { ContentCard } from "@/components/content-card";
import { LoadingBlock } from "@/components/loading-block";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { useBillingStatus } from "@/hooks/queries/use-billing";
import { useTenant } from "@/providers/tenant-provider";

function SettingsRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export function SettingsPage() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { data: billing, isLoading, isError, error } = useBillingStatus();

  if (isLoading) {
    return (
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  if (isError) {
    return (
      <AppPage>
        <Alert variant="destructive">
          <AlertTitle>Unable to load settings</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Something went wrong"}
          </AlertDescription>
        </Alert>
      </AppPage>
    );
  }

  return (
    <AppPage>
      <div className="grid gap-5 lg:grid-cols-2">
        <ContentCard
          title="Profile"
          description="Your account details"
          bodyClassName="divide-y divide-border/60"
        >
          <dl>
            <SettingsRow label="Email" value={user?.email ?? "—"} />
            <SettingsRow
              label="Role"
              value={
                <span className="capitalize">
                  {user?.role?.replace("_", " ") ?? "—"}
                </span>
              }
            />
          </dl>
        </ContentCard>

        <ContentCard
          title="Workspace"
          description="Organization you are signed into"
          bodyClassName="divide-y divide-border/60"
        >
          <dl>
            <SettingsRow label="Name" value={tenant?.name ?? "—"} />
            <SettingsRow label="Slug" value={tenant?.slug ?? "—"} />
          </dl>
        </ContentCard>

        <ContentCard
          title="Billing"
          description="Plan and subscription status"
          className="lg:col-span-2"
          bodyClassName="divide-y divide-border/60"
        >
          <dl>
            <SettingsRow
              label="Mode"
              value={
                <span className="capitalize">{billing?.billingMode ?? "—"}</span>
              }
            />
            <SettingsRow
              label="Card payments"
              value={
                <Badge
                  variant={billing?.paymentsEnabled ? "default" : "secondary"}
                >
                  {billing?.paymentsEnabled ? "Enabled" : "Disabled"}
                </Badge>
              }
            />
            {billing?.subscription ? (
              <>
                <SettingsRow
                  label="Plan"
                  value={
                    <span className="capitalize">
                      {billing.subscription.plan}
                    </span>
                  }
                />
                <SettingsRow
                  label="Status"
                  value={
                    <span className="capitalize">
                      {billing.subscription.status}
                    </span>
                  }
                />
                {billing.subscription.daysRemaining != null ? (
                  <SettingsRow
                    label="Trial remaining"
                    value={`${billing.subscription.daysRemaining} days`}
                  />
                ) : null}
              </>
            ) : null}
          </dl>
          <p className="pt-3 text-xs text-muted-foreground">
            Billing is manual during beta. Contact your admin to extend trial or
            activate a paid plan.
          </p>
        </ContentCard>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="app-card flex items-center gap-3 rounded-xl p-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserCircle className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium">Account</p>
            <p className="text-xs text-muted-foreground">Profile & security</p>
          </div>
        </div>
        <div className="app-card flex items-center gap-3 rounded-xl p-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium">Workspace</p>
            <p className="text-xs text-muted-foreground">Org preferences</p>
          </div>
        </div>
        <div className="app-card flex items-center gap-3 rounded-xl p-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CreditCard className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium">Billing</p>
            <p className="text-xs text-muted-foreground">Plan & invoices</p>
          </div>
        </div>
      </div>
    </AppPage>
  );
}
