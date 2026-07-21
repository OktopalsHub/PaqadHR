'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlanPricingCard } from '@/features/billing/components/plan-pricing-card';
import { usePricingPreview } from '@/hooks/queries/use-pricing-preview';
import { loadUserTenantsWithRetry, waitForAuthenticatedProfile } from '@/lib/api/auth';
import { checkSlugAvailability, completeOnboarding } from '@/lib/api/onboarding';
import { getPlanCatalog } from '@/lib/constants/plan-catalog';
import { tenantUrl } from '@/lib/navigation/tenant-routes';
import { queryKeys } from '@/lib/query/keys';
import { persistTenantSlug } from '@/lib/session';
import { cn } from '@/lib/utils';
import {
  formatWorkspaceUrl,
  getAppBaseUrl,
  getAppUrlSuffix,
  isSlugFormatValid,
  slugifyInput,
} from '@/lib/utils/slug';

const STEPS = ['Company', 'You', 'Plan', 'Review'] as const;

const INDUSTRIES = [
  'Technology',
  'Finance',
  'Healthcare',
  'Retail',
  'Manufacturing',
  'Professional Services',
  'Other',
];

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="font-medium sm:text-right">{value}</dd>
    </div>
  );
}

export function OnboardingWizard() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const employeeCodeTouchedRef = useRef(false);
  const [debouncedSlug, setDebouncedSlug] = useState('');
  const [appBaseUrl, setAppBaseUrl] = useState('');
  const [appUrlSuffix, setAppUrlSuffix] = useState('');
  const slugTouchedRef = useRef(false);
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('growth');
  const pricingPreview = usePricingPreview();
  const sortedPlans = useMemo(() => {
    const plans = pricingPreview.data?.pricing ?? [];
    return [...plans].sort((a, b) => {
      const orderA = getPlanCatalog(a.plan.slug)?.sortOrder ?? 99;
      const orderB = getPlanCatalog(b.plan.slug)?.sortOrder ?? 99;
      return orderA - orderB;
    });
  }, [pricingPreview.data?.pricing]);

  useEffect(() => {
    setAppBaseUrl(getAppBaseUrl());
    setAppUrlSuffix(getAppUrlSuffix());
  }, []);

  useEffect(() => {
    if (slugTouchedRef.current) return;
    if (!name.trim()) {
      setSlug('');
      return;
    }
    setSlug(slugifyInput(name));
  }, [name]);

  useEffect(() => {
    if (employeeCodeTouchedRef.current) return;
    if (!name.trim()) {
      setEmployeeCode('');
      return;
    }
    const words = name.trim().split(/\s+/).filter(Boolean);
    let code = '';
    if (words.length === 1) {
      code = words[0].substring(0, 3).toUpperCase();
    } else {
      code = words
        .slice(0, 3)
        .map((w) => w[0])
        .join('')
        .toUpperCase();
    }
    setEmployeeCode(code.replace(/[^A-Z0-9]/g, ''));
  }, [name]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSlug(slug.trim());
    }, 400);
    return () => window.clearTimeout(timer);
  }, [slug]);

  const slugFormatValid = isSlugFormatValid(slug.trim());
  const isEmployeeCodeValid = employeeCode.trim().length >= 2 && employeeCode.trim().length <= 10;

  const debouncedSlugValid = isSlugFormatValid(debouncedSlug);

  const slugAvailabilityQuery = useQuery({
    queryKey: queryKeys.onboarding.slugAvailability(debouncedSlug),
    queryFn: () => checkSlugAvailability(debouncedSlug),
    enabled: debouncedSlug.length >= 2 && debouncedSlugValid,
    retry: false,
    staleTime: 30_000,
  });

  const slugCheckPending =
    slug.trim().length >= 2 &&
    debouncedSlugValid &&
    (debouncedSlug !== slug.trim() || slugAvailabilityQuery.isFetching);

  const slugBlocked =
    slug.trim().length >= 2 &&
    debouncedSlug === slug.trim() &&
    debouncedSlugValid &&
    slugAvailabilityQuery.isSuccess &&
    !slugAvailabilityQuery.data.available;

  const canContinueStep0 =
    name.trim().length >= 2 && slugFormatValid && !slugBlocked && isEmployeeCodeValid;

  const completeMutation = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: async (result) => {
      await waitForAuthenticatedProfile({ attempts: 6, baseDelayMs: 150 });

      const tenants = await loadUserTenantsWithRetry({ attempts: 8, baseDelayMs: 250 });
      queryClient.setQueryData(queryKeys.tenants.all, tenants);
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });

      if (result.tenant?.id) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.member.profile(result.tenant.id),
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.billing.status(result.tenant.id),
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.billing.overview(result.tenant.id),
        });
      }

      toast.success(`Workspace "${result.tenant.name}" is ready — your 14-day trial has started`);

      if (result.tenant.slug) {
        persistTenantSlug(result.tenant.slug);
        window.location.assign(tenantUrl(result.tenant.slug, '/'));
      }
    },
    onError: (error: Error) => {
      const message =
        error.message === 'Could not reach the server. Check your connection and try again.'
          ? 'Could not reach the server. Make sure the API is running and NEXT_PUBLIC_API_URL is set correctly.'
          : error.message;
      toast.error(message);
    },
  });

  const selectedPlanDetails = sortedPlans.find((plan) => plan.plan.slug === selectedPlan);

  const canContinue =
    step === 0
      ? canContinueStep0
      : step === 1
        ? firstName.trim().length >= 1 && lastName.trim().length >= 1 && jobTitle.trim().length >= 2
        : step === 2
          ? Boolean(selectedPlan) && !pricingPreview.isLoading
          : true;

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    completeMutation.mutate({
      name: name.trim(),
      slug: slugifyInput(slug.trim()),
      industry: industry || undefined,
      companySize: companySize || undefined,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      preferredName: preferredName.trim() || undefined,
      jobTitle: jobTitle.trim(),
      employeeCode: employeeCode.trim() || undefined,
      planSlug: selectedPlan,
    });
  };

  return (
    <div className={cn('mx-auto w-full', step >= 2 ? 'max-w-6xl' : 'max-w-lg')}>
      <div className="mb-10 flex items-center justify-center gap-2">
        {STEPS.map((label, index) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                'flex size-8 items-center justify-center rounded-full border text-xs font-medium transition-colors',
                index <= step
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground',
              )}
            >
              {index + 1}
            </div>
            {index < STEPS.length - 1 ? (
              <div className={cn('h-px w-8', index < step ? 'bg-foreground' : 'bg-border')} />
            ) : null}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border bg-card p-8 shadow-sm">
        {step === 0 ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Set up your company</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tell us about your organization to personalize your workspace.
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Company name</Label>
                <Input
                  id="company-name"
                  placeholder="Acme Inc."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="workspace-slug">Workspace slug</Label>
                <div className="flex overflow-hidden rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                  <span className="flex max-w-[55%] shrink-0 items-center border-r border-input bg-muted/50 px-3 text-xs text-muted-foreground sm:max-w-none sm:text-sm">
                    {appBaseUrl || '…/'}
                  </span>
                  <Input
                    id="workspace-slug"
                    value={slug}
                    onChange={(e) => {
                      slugTouchedRef.current = true;
                      setSlug(slugifyInput(e.target.value));
                    }}
                    placeholder="acme-inc"
                    className="border-0 shadow-none focus-visible:ring-0"
                    aria-describedby="workspace-slug-hint"
                  />
                  {appUrlSuffix ? (
                    <span className="flex shrink-0 items-center border-l border-input bg-muted/50 px-3 text-xs text-muted-foreground sm:max-w-none sm:text-sm">
                      {appUrlSuffix}
                    </span>
                  ) : null}
                </div>
                <p
                  id="workspace-slug-hint"
                  className={cn(
                    'flex items-center gap-1.5 text-xs',
                    slugCheckPending && 'text-muted-foreground',
                    slug.trim().length >= 2 &&
                      !slugCheckPending &&
                      slugAvailabilityQuery.data?.available &&
                      'text-emerald-600 dark:text-emerald-400',
                    slugBlocked && 'text-destructive',
                    slug.trim().length >= 2 && !slugFormatValid && 'text-destructive',
                    slug.trim().length < 2 && 'text-muted-foreground',
                  )}
                >
                  {slug.trim().length < 2 ? (
                    'Pick a short slug for your workspace. It cannot be changed later.'
                  ) : !slugFormatValid ? (
                    <>
                      <XCircle className="size-3.5 shrink-0" />
                      Use 2–25 lowercase letters, numbers, and hyphens.
                    </>
                  ) : slugCheckPending ? (
                    'Checking availability…'
                  ) : slugAvailabilityQuery.data?.available ? (
                    <>
                      <CheckCircle2 className="size-3.5 shrink-0" />
                      This slug is available.
                    </>
                  ) : slugAvailabilityQuery.data?.reason === 'taken' ? (
                    <>
                      <XCircle className="size-3.5 shrink-0" />
                      This slug is already taken.
                    </>
                  ) : slugAvailabilityQuery.data?.reason === 'reserved' ? (
                    <>
                      <XCircle className="size-3.5 shrink-0" />
                      This slug is reserved.
                    </>
                  ) : null}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenant-code">Tenant Code</Label>
                <Input
                  id="tenant-code"
                  placeholder="e.g. EMP, ZPR"
                  value={employeeCode}
                  onChange={(e) => {
                    employeeCodeTouchedRef.current = true;
                    setEmployeeCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                  }}
                  maxLength={10}
                />
                <p
                  className={cn(
                    'text-xs',
                    !isEmployeeCodeValid && employeeCode.length > 0
                      ? 'text-destructive'
                      : 'text-muted-foreground',
                  )}
                >
                  {!isEmployeeCodeValid && employeeCode.length > 0
                    ? 'Tenant code must be between 2 and 10 characters.'
                    : `Short identifier prefix for employee IDs (e.g., ${employeeCode || 'EMP'}001).`}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Select value={industry} onValueChange={setIndustry}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Company size</Label>
                  <Select value={companySize} onValueChange={setCompanySize}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPANY_SIZES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item} employees
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">About you</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This is how you&apos;ll appear to your team in the workspace.
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First name</Label>
                  <Input
                    id="first-name"
                    placeholder="Jane"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last name</Label>
                  <Input
                    id="last-name"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferred-name">
                  Preferred name{' '}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="preferred-name"
                  placeholder="What should we call you on the dashboard?"
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-title">Job position</Label>
                <Input
                  id="job-title"
                  placeholder="Head of People"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold tracking-tight">Choose your plan</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                14 days free on any plan. No card required.
              </p>
            </div>

            {pricingPreview.isLoading ? (
              <div className="flex min-h-[200px] items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : pricingPreview.isError || sortedPlans.length === 0 ? (
              <p className="text-center text-sm text-destructive">
                {pricingPreview.error instanceof Error
                  ? pricingPreview.error.message
                  : 'Unable to load plans. Refresh and try again.'}
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {sortedPlans.map((plan) => {
                  const isSelected = selectedPlan === plan.plan.slug;
                  return (
                    <button
                      key={plan.plan.slug}
                      type="button"
                      className="h-full text-left"
                      onClick={() => setSelectedPlan(plan.plan.slug)}
                    >
                      <PlanPricingCard
                        slug={plan.plan.slug}
                        name={plan.plan.name}
                        description={plan.plan.description}
                        currency={plan.currency}
                        pricePerSeat={plan.monthlyPrice}
                        isPopular={plan.plan.slug === 'growth'}
                        variant="marketing"
                        className={cn('h-full', isSelected && 'ring-2 ring-primary')}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Review and start your trial</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Confirm your workspace details. We&apos;ll create everything when you start your
                trial.
              </p>
            </div>

            <dl className="divide-y rounded-xl border bg-muted/20 text-sm">
              <ReviewRow label="Workspace name" value={name.trim() || '—'} />
              <ReviewRow
                label="Workspace URL"
                value={slug.trim() ? formatWorkspaceUrl(slug.trim()) : '—'}
              />
              <ReviewRow label="Industry" value={industry || '—'} />
              <ReviewRow label="Team size" value={companySize ? `${companySize} employees` : '—'} />
              <ReviewRow label="Tenant code" value={employeeCode.trim() || '—'} />
              <ReviewRow
                label="Owner"
                value={[firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || '—'}
              />
              {preferredName.trim() ? (
                <ReviewRow label="Preferred name" value={preferredName.trim()} />
              ) : null}
              <ReviewRow label="Job position" value={jobTitle.trim() || '—'} />
              <ReviewRow
                label="Plan"
                value={
                  selectedPlanDetails ? `${selectedPlanDetails.plan.name} · 14-day free trial` : '—'
                }
              />
            </dl>

            <p className="text-center text-xs text-muted-foreground">
              Payroll and automated payouts are included on every plan during your trial.
            </p>
          </div>
        ) : null}

        <div className="mt-8 flex justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0 || completeMutation.isPending}
            onClick={() => setStep(step - 1)}
          >
            Back
          </Button>
          <Button
            type="button"
            disabled={!canContinue || completeMutation.isPending}
            onClick={handleNext}
          >
            {step === STEPS.length - 1
              ? completeMutation.isPending
                ? 'Creating workspace…'
                : 'Start 14-day free trial'
              : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}
