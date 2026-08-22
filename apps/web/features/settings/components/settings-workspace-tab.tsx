'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ContentCard } from '@/components/content-card';
import { LogoUpload } from '@/components/logo-upload';
import { SearchSelect } from '@/components/search-select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { SettingsFieldHint } from '@/features/settings/components/settings-field-hint';
import { SettingsFormActions } from '@/features/settings/components/settings-form-actions';
import { resolveInitialPayrollCurrencies } from '@/features/settings/lib/workspace-payroll-currencies';
import { useWorkspaceLogoUpload } from '@/hooks/queries/use-image-upload';
import {
  usePatchTenantSettings,
  useSupportedHolidayCountries,
  useTenantSettings,
} from '@/hooks/queries/use-tenant-settings';
import { useUpdateTenant } from '@/hooks/queries/use-tenants';
import { SUPPORTED_CRYPTO_CURRENCIES, SUPPORTED_FIAT_CURRENCIES } from '@/lib/constants/currencies';
import { cn } from '@/lib/utils';
import { useTenant } from '@/providers/tenant-provider';

const timezoneOptions = Intl.supportedValuesOf('timeZone').map((tz) => ({
  value: tz,
  label: tz,
}));

export function SettingsWorkspaceTab() {
  const { tenant, tenantId } = useTenant();
  const { data: settings } = useTenantSettings();
  const { data: countriesData } = useSupportedHolidayCountries();
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
  const [cryptoEnabled, setCryptoEnabled] = useState(false);
  const [emailPayslipOnPublish, setEmailPayslipOnPublish] = useState(false);
  const [requireIdentityForPayroll, setRequireIdentityForPayroll] = useState(false);

  const workspaceCountry = tenant?.countryCode ?? settings?.settings?.holidays?.countryCode ?? '';
  const _countryLabel =
    (countriesData?.countries ?? []).find((country) => country.code === workspaceCountry)?.name ??
    workspaceCountry;

  useEffect(() => {
    if (!tenant) return;
    setName(tenant.name ?? '');
    setLogoUrl(tenantLogoUrl);
    setTimezone(tenant.timezone ?? 'UTC');
    setEmployeeCode(tenant.employeeCode ?? '');

    const general = settings?.settings?.general;
    setEmailPayslipOnPublish(general?.emailPayslipOnPublish ?? false);
    setRequireIdentityForPayroll(settings?.settings?.employee?.requireIdentityForPayroll ?? false);
    setCryptoEnabled(general?.cryptoEnabled ?? false);
    setPayrollCurrencies(
      resolveInitialPayrollCurrencies({
        countryCode: workspaceCountry,
        settingsPayrollCurrencies: general?.payrollCurrencies,
        settingsCurrency: general?.currency,
        tenantPreferredCurrency: tenant.preferredCurrency,
      }),
    );
  }, [tenant, settings, tenantLogoUrl, workspaceCountry]);

  const toggleCurrency = (code: string) => {
    setPayrollCurrencies((current) => {
      if (current.includes(code)) {
        if (current.length === 1) {
          toast.error('At least one payroll currency is required');
          return current;
        }
        return current.filter((item) => item !== code);
      }
      return [...current, code];
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
    const previousPrimary = (tenant?.preferredCurrency ?? 'USD').toUpperCase();
    if (primaryCurrency && primaryCurrency !== previousPrimary) {
      const confirmed = window.confirm(
        `Change workspace default from ${previousPrimary} to ${primaryCurrency}? Employees still paid in ${previousPrimary} must have their salary currency updated first. If your rewards wallet already has a balance, the change will be blocked until the balance is spent.`,
      );
      if (!confirmed) return;
    }

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
          cryptoEnabled,
        },
      });
      toast.success('Workspace settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save workspace');
    }
  };

  const saveEmailSettings = async (value: boolean) => {
    try {
      const existingGeneral = settings?.settings?.general;
      await patchSettings.mutateAsync({
        general: {
          ...existingGeneral,
          emailPayslipOnPublish: value,
        },
      });
      toast.success('Email settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save email settings');
    }
  };

  const savePayrollIdentitySettings = async (value: boolean) => {
    try {
      const existingEmployee = settings?.settings?.employee;
      await patchSettings.mutateAsync({
        employee: {
          ...existingEmployee,
          requireIdentityForPayroll: value,
        },
      });
      toast.success('Payroll identity settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save payroll identity settings');
    }
  };

  return (
    <div className="space-y-5">
      <ContentCard title="Workspace" bodyClassName="space-y-6 p-5">
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

        <div className="grid gap-4 lg:grid-cols-2">
          <SettingsFieldHint
            htmlFor="workspace-name"
            label="Company name"
            className="lg:col-span-2"
          >
            <Input id="workspace-name" value={name} onChange={(e) => setName(e.target.value)} />
          </SettingsFieldHint>

          <SettingsFieldHint htmlFor="workspace-slug" label="Workspace URL">
            <Input
              id="workspace-slug"
              value={tenant?.slug ?? ''}
              readOnly
              className="bg-white/60 text-slate-500 dark:bg-slate-950/40 dark:text-slate-300"
            />
          </SettingsFieldHint>

          <SettingsFieldHint htmlFor="workspace-employee-code" label="Tenant Code">
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
            className="lg:col-span-2"
          >
            <SearchSelect
              id="workspace-timezone"
              options={timezoneOptions}
              value={timezone}
              onValueChange={setTimezone}
              placeholder="Select timezone…"
              searchPlaceholder="Search timezone…"
            />
          </SettingsFieldHint>

          <SettingsFieldHint label="Payroll currencies" className="lg:col-span-2">
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

          <SettingsFieldHint label="Crypto payroll" className="lg:col-span-2">
            <div className="flex items-center gap-3">
              <Switch
                id="crypto-enabled"
                checked={cryptoEnabled}
                onCheckedChange={setCryptoEnabled}
                disabled={!isAdmin}
              />
              <label htmlFor="crypto-enabled" className="text-sm text-muted-foreground">
                {cryptoEnabled ? 'Enabled' : 'Disabled'}
              </label>
            </div>
            {cryptoEnabled && (
              <div className="mt-3 flex flex-wrap gap-2">
                {SUPPORTED_CRYPTO_CURRENCIES.map((code) => (
                  <Badge
                    key={code}
                    variant="default"
                    className="cursor-default px-3 py-1.5 text-xs"
                  >
                    {code}
                  </Badge>
                ))}
              </div>
            )}
          </SettingsFieldHint>

          <div className="lg:col-span-2 flex justify-start sm:justify-end">
            <SettingsFormActions
              onSave={saveWorkspace}
              isPending={updateTenant.isPending || patchSettings.isPending}
            />
          </div>
        </div>
      </ContentCard>

      <ContentCard title="Payroll identity">
        <SettingsFieldHint label="Require BVN or NIN for payroll">
          <div className="flex items-center gap-3">
            <Switch
              id="require-identity-for-payroll"
              checked={requireIdentityForPayroll}
              onCheckedChange={(checked) => {
                setRequireIdentityForPayroll(checked);
                void savePayrollIdentitySettings(checked);
              }}
              disabled={!isAdmin || patchSettings.isPending}
            />
            <label htmlFor="require-identity-for-payroll" className="text-sm text-muted-foreground">
              {requireIdentityForPayroll ? 'Required' : 'Optional'}
            </label>
          </div>
        </SettingsFieldHint>
      </ContentCard>

      <ContentCard title="Email Settings">
        <div className="space-y-4">
          <SettingsFieldHint label="Email payslips on publish">
            <div className="flex items-center gap-3">
              <Switch
                id="email-payslip-on-publish"
                checked={emailPayslipOnPublish}
                onCheckedChange={(checked) => {
                  setEmailPayslipOnPublish(checked);
                  void saveEmailSettings(checked);
                }}
                disabled={patchSettings.isPending}
              />
              <label htmlFor="email-payslip-on-publish" className="text-sm text-muted-foreground">
                {emailPayslipOnPublish ? 'Enabled' : 'Disabled'}
              </label>
            </div>
          </SettingsFieldHint>
        </div>
      </ContentCard>
    </div>
  );
}
