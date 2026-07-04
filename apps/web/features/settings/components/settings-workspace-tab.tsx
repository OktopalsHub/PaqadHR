'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ContentCard } from '@/components/content-card';
import { LogoUpload } from '@/components/logo-upload';
import { SearchSelect } from '@/components/search-select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { SettingsFieldHint } from '@/features/settings/components/settings-field-hint';
import { SettingsFormActions } from '@/features/settings/components/settings-form-actions';
import { useWorkspaceLogoUpload } from '@/hooks/queries/use-image-upload';
import { useShoutoutSlackStatus } from '@/hooks/queries/use-integrations';
import { usePatchTenantSettings, useTenantSettings } from '@/hooks/queries/use-tenant-settings';
import { useUpdateTenant } from '@/hooks/queries/use-tenants';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { SUPPORTED_FIAT_CURRENCIES } from '@/lib/constants/currencies';
import { cn } from '@/lib/utils';
import { useTenant } from '@/providers/tenant-provider';

const timezoneOptions = Intl.supportedValuesOf('timeZone').map((tz) => ({
  value: tz,
  label: tz,
}));

function WorkspaceSlackStatus() {
  const { tenant } = useTenant();
  const tenantHref = useTenantHref();
  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';
  const { data: status, isLoading } = useShoutoutSlackStatus();
  const slackPageHref = tenantHref('integrations/slack');

  if (!isAdmin) {
    return null;
  }

  if (isLoading) {
    return (
      <ContentCard title="Slack" description="Shoutouts integration">
        <p className="text-sm text-muted-foreground">Loading Slack status…</p>
      </ContentCard>
    );
  }

  let statusText = 'Slack is not connected. Connect to post shoutouts to a channel.';
  if (status?.configured) {
    statusText = `Connected · shoutouts post to ${status.channelName ?? 'your channel'}`;
  } else if (status?.integrationId) {
    statusText = 'Slack is connected. Choose a channel for shoutouts.';
  }

  return (
    <ContentCard title="Slack" description="Post team shoutouts to a Slack channel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{statusText}</p>
        <Button size="sm" variant="outline" asChild>
          <Link href={slackPageHref}>{status?.configured ? 'Manage Slack' : 'Connect Slack'}</Link>
        </Button>
      </div>
    </ContentCard>
  );
}

export function SettingsWorkspaceTab() {
  const { tenant, tenantId } = useTenant();
  const { data: settings } = useTenantSettings();
  const updateTenant = useUpdateTenant();
  const patchSettings = usePatchTenantSettings();
  const logoUpload = useWorkspaceLogoUpload();

  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';
  const tenantLogoUrl = (tenant as { logoUrl?: string | null } | null)?.logoUrl ?? null;

  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [timezone, setTimezone] = useState('UTC');
  const [employeeCode, setEmployeeCode] = useState('');
  const [payrollCurrencies, setPayrollCurrencies] = useState<string[]>(['USD']);
  const [emailPayslipOnPublish, setEmailPayslipOnPublish] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    setName(tenant.name ?? '');
    setLogoUrl(tenantLogoUrl);
    setTimezone((tenant as { timezone?: string }).timezone ?? 'UTC');
    setEmployeeCode((tenant as { employeeCode?: string }).employeeCode ?? '');

    const general = settings?.settings?.general;
    setEmailPayslipOnPublish(general?.emailPayslipOnPublish ?? false);
    const fromSettings = general?.payrollCurrencies
      ?.map((code) => code.toUpperCase())
      .filter(Boolean);
    if (fromSettings && fromSettings.length > 0) {
      setPayrollCurrencies(fromSettings);
      return;
    }

    const primary = (
      general?.currency ??
      (tenant as { preferredCurrency?: string }).preferredCurrency ??
      'USD'
    ).toUpperCase();
    setPayrollCurrencies([primary]);
  }, [tenant, settings, tenantLogoUrl]);

  const toggleCurrency = (code: string) => {
    setPayrollCurrencies((current) => {
      if (current.includes(code)) {
        if (current.length === 1) {
          toast.error('At least one payroll currency is required');
          return current;
        }
        return current.filter((item) => item !== code);
      }
      return [...current, code].sort();
    });
  };

  const saveWorkspace = async () => {
    if (!tenantId || !name.trim()) {
      toast.error('Company name is required');
      return;
    }
    if (payrollCurrencies.length === 0) {
      toast.error('Select at least one payroll currency');
      return;
    }
    if (employeeCode.trim()) {
      const code = employeeCode.trim();
      if (code.length < 2 || code.length > 10 || !/^[a-zA-Z0-9]+$/.test(code)) {
        toast.error('Tenant Code must be between 2 and 10 alphanumeric characters');
        return;
      }
    }

    const primaryCurrency = payrollCurrencies[0]?.toUpperCase();

    try {
      await updateTenant.mutateAsync({
        tenantId,
        input: {
          name: name.trim(),
          timezone: timezone.trim() || 'UTC',
          preferredCurrency: primaryCurrency,
          ...(employeeCode.trim() ? { employeeCode: employeeCode.trim().toUpperCase() } : {}),
        },
      });
      const existingGeneral = settings?.settings?.general;
      await patchSettings.mutateAsync({
        general: {
          ...existingGeneral,
          companyName: name.trim(),
          timezone: timezone.trim() || 'UTC',
          dateFormat: existingGeneral?.dateFormat ?? 'YYYY-MM-DD',
          language: existingGeneral?.language ?? 'en',
          currency: primaryCurrency,
          payrollCurrencies: payrollCurrencies.map((code) => code.toUpperCase()),
        },
      });
      toast.success('Workspace settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save workspace');
    }
  };

  const saveEmailSettings = async () => {
    try {
      const existingGeneral = settings?.settings?.general;
      await patchSettings.mutateAsync({
        general: {
          ...existingGeneral,
          emailPayslipOnPublish,
        },
      });
      toast.success('Email settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save email settings');
    }
  };

  return (
    <div className="space-y-5">
      <ContentCard
        title="Workspace"
        description="Organization settings"
        bodyClassName="space-y-6 p-5"
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="dashboard-soft-tile rounded-[8px] px-5 py-5">
            <p className="dashboard-outline-label text-[11px] font-semibold uppercase">Branding</p>
            <div className="mt-4">
              <LogoUpload
                name={name || tenant?.name || 'Workspace'}
                src={logoUrl}
                disabled={!isAdmin || logoUpload.isPending}
                onUpload={async (file) => {
                  const url = await logoUpload.mutateAsync(file);
                  if (url) setLogoUrl(url);
                  return url;
                }}
                onError={(message) => toast.error(message)}
              />
            </div>
          </div>

          <div className="dashboard-soft-tile rounded-[8px] px-5 py-5">
            <p className="dashboard-outline-label text-[11px] font-semibold uppercase">
              Workspace overview
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[8px] border border-[#d7e3f6] bg-white/75 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/55">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Workspace URL
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                  {tenant?.slug ?? '—'}
                </p>
              </div>
              <div className="rounded-[8px] border border-[#d7e3f6] bg-white/75 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/55">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Tenant code
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                  {employeeCode || 'Not set'}
                </p>
              </div>
              <div className="rounded-[8px] border border-[#d7e3f6] bg-white/75 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/55">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Default currency
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                  {payrollCurrencies[0] ?? 'USD'}
                </p>
              </div>
              <div className="rounded-[8px] border border-[#d7e3f6] bg-white/75 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/55">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Timezone</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                  {timezone || 'UTC'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SettingsFieldHint
            htmlFor="workspace-name"
            label="Company name"
            hint="The name shown across the workspace and on invoices."
            className="lg:col-span-2"
          >
            <Input id="workspace-name" value={name} onChange={(e) => setName(e.target.value)} />
          </SettingsFieldHint>

          <SettingsFieldHint
            htmlFor="workspace-slug"
            label="Workspace URL"
            hint="Your workspace slug cannot be changed after creation."
          >
            <Input
              id="workspace-slug"
              value={tenant?.slug ?? ''}
              readOnly
              className="bg-white/60 text-slate-500 dark:bg-slate-950/40 dark:text-slate-300"
            />
          </SettingsFieldHint>

          <SettingsFieldHint
            htmlFor="workspace-employee-code"
            label="Tenant Code"
            hint="Unique alphanumeric code for your tenant, also prepended to employee numbers (e.g. PAQ → PAQ-1001). Min 2, max 10 characters."
          >
            <Input
              id="workspace-employee-code"
              placeholder="e.g. PAQ"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              maxLength={10}
            />
          </SettingsFieldHint>

          <SettingsFieldHint
            htmlFor="workspace-timezone"
            label="Timezone"
            hint="Used for schedules, attendance, and date displays."
            className="lg:col-span-2"
          >
            <SearchSelect
              options={timezoneOptions}
              value={timezone}
              onValueChange={setTimezone}
              placeholder="Select timezone…"
              searchPlaceholder="Search timezone…"
            />
          </SettingsFieldHint>

          <SettingsFieldHint
            label="Payroll currencies"
            hint="Members can only add bank accounts in these currencies. The first selected currency is the workspace default for billing and payroll."
            className="lg:col-span-2"
          >
            <div className="dashboard-soft-tile rounded-[8px] px-4 py-4">
              <div className="flex flex-wrap gap-2">
                {SUPPORTED_FIAT_CURRENCIES.map((code) => {
                  const selected = payrollCurrencies.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggleCurrency(code)}
                      className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Badge
                        variant={selected ? 'default' : 'outline'}
                        className={cn(
                          'cursor-pointer px-3 py-1.5 text-xs transition-colors',
                          !selected &&
                            'border-[#d7e3f6] bg-white/70 text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-950/55 dark:text-slate-200 dark:hover:bg-slate-900',
                        )}
                      >
                        {code}
                      </Badge>
                    </button>
                  );
                })}
              </div>
              {payrollCurrencies.length > 0 ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Default:{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {payrollCurrencies[0]}
                  </span>
                  {payrollCurrencies.length > 1
                    ? ` · Also enabled: ${payrollCurrencies.slice(1).join(', ')}`
                    : ''}
                </p>
              ) : null}
            </div>
          </SettingsFieldHint>

          <div className="lg:col-span-2 flex justify-start sm:justify-end">
            <SettingsFormActions
              onSave={saveWorkspace}
              isPending={updateTenant.isPending || patchSettings.isPending}
            />
          </div>
        </div>
      </ContentCard>

      <ContentCard
        title="Email Settings"
        description="Configure automated email notifications for your workspace."
      >
        <div className="space-y-4">
          <SettingsFieldHint
            label="Email payslips on publish"
            hint="When enabled, employees receive an email notification when an admin publishes their payslip. You can still override this per publish action on the payroll run."
          >
            <div className="flex items-center gap-3">
              <Switch
                id="email-payslip-on-publish"
                checked={emailPayslipOnPublish}
                onCheckedChange={setEmailPayslipOnPublish}
              />
              <label htmlFor="email-payslip-on-publish" className="text-sm text-muted-foreground">
                {emailPayslipOnPublish ? 'Enabled' : 'Disabled'}
              </label>
            </div>
          </SettingsFieldHint>

          <SettingsFormActions onSave={saveEmailSettings} isPending={patchSettings.isPending} />
        </div>
      </ContentCard>

      <WorkspaceSlackStatus />
    </div>
  );
}
