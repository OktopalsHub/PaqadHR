'use client';

import { Building2, CreditCard, UserCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { AppPage } from '@/components/app-page';
import { ContentCard } from '@/components/content-card';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BillingSection } from '@/features/settings/components/billing-section';
import { PaymentAdminSection } from '@/features/settings/components/payment-admin-section';
import { PaymentSettingsSection } from '@/features/settings/components/payment-settings-section';
import { PrivacySection } from '@/features/settings/components/privacy-section';
import { SlackIntegrationSection } from '@/features/settings/components/slack-integration-section';
import { useBillingStatus } from '@/hooks/queries/use-billing';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/providers/tenant-provider';

function SettingsRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function SettingsPageContent() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { isLoading, isError, error } = useBillingStatus();

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
            {error instanceof Error ? error.message : 'Something went wrong'}
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
            <SettingsRow label="Email" value={user?.email ?? '—'} />
            <SettingsRow
              label="Role"
              value={<span className="capitalize">{user?.role?.replace('_', ' ') ?? '—'}</span>}
            />
          </dl>
        </ContentCard>

        <ContentCard
          title="Workspace"
          description="Organization you are signed into"
          bodyClassName="divide-y divide-border/60"
        >
          <dl>
            <SettingsRow label="Name" value={tenant?.name ?? '—'} />
            <SettingsRow label="Slug" value={tenant?.slug ?? '—'} />
          </dl>
        </ContentCard>

        <ContentCard
          title="Billing"
          description="Plan, seats, and subscription checkout"
          className="lg:col-span-2"
        >
          <BillingSection />
        </ContentCard>

        <ContentCard
          title="Payment settings"
          description="Bank account for receiving payroll"
          className="lg:col-span-2"
        >
          <PaymentSettingsSection />
        </ContentCard>

        <ContentCard
          title="Verify employee payment details"
          description="Approve bank accounts before payroll can pay employees"
          className="lg:col-span-2"
        >
          <PaymentAdminSection />
        </ContentCard>

        <ContentCard
          title="Slack shoutouts"
          description="Post team recognition to a Slack channel"
          className="lg:col-span-2"
        >
          <SlackIntegrationSection />
        </ContentCard>

        <ContentCard
          title="Privacy & data"
          description="Export or delete your personal data"
          className="lg:col-span-2"
        >
          <PrivacySection />
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
            <p className="text-xs text-muted-foreground">Per-seat plans</p>
          </div>
        </div>
      </div>
    </AppPage>
  );
}

export function SettingsPage() {
  return (
    <Suspense
      fallback={
        <AppPage>
          <LoadingBlock />
        </AppPage>
      }
    >
      <SettingsPageContent />
    </Suspense>
  );
}
