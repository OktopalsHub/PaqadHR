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
import { clampOnboardingStep } from '@/features/onboarding/lib/onboarding-step';
import {
  ONBOARDING_STEP_DETAILS,
  ONBOARDING_STEPS,
} from '@/features/onboarding/lib/onboarding-steps';
import { usePricingPreview } from '@/hooks/queries/use-pricing-preview';
import { loadUserTenantsWithRetry, waitForAuthenticatedProfile } from '@/lib/api/auth';
import { checkSlugAvailability, completeOnboarding } from '@/lib/api/onboarding';
import { fetchBillingStatus } from '@/lib/api/subscriptions';
import { getPlanCatalog } from '@/lib/constants/plan-catalog';
import { subscribePageUrl, tenantUrl } from '@/lib/navigation/tenant-routes';
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

const fieldLabelClass = 'text-[13px] font-semibold tracking-[0.01em] text-slate-700';
const inputClass =
  'h-10 rounded-[16px] border-slate-200 bg-white px-4 text-[15px] text-slate-900 shadow-[0_10px_30px_-28px_rgba(15,23,42,0.45)] placeholder:text-slate-400 focus-visible:ring-[3px] focus-visible:ring-emerald-500/18';
const selectTriggerClass =
  'h-10 w-full rounded-[16px] border-slate-200 bg-white px-4 text-[15px] text-slate-900 shadow-[0_10px_30px_-28px_rgba(15,23,42,0.45)] focus-visible:ring-[3px] focus-visible:ring-emerald-500/18 focus-visible:ring-offset-0';

function ReviewRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[18px] border border-slate-200/80 bg-white/82 px-4 py-3 shadow-[0_12px_30px_-30px_rgba(15,23,42,0.24)]',
        className,
      )}
    >
      <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm font-semibold leading-5 text-slate-900">{value}</dd>
    </div>
  );
}

type OnboardingWizardProps = {
  step: number;
  onStepChange: (step: number) => void;
};

export function OnboardingWizard({ step, onStepChange }: OnboardingWizardProps) {
  const queryClient = useQueryClient();
  const normalizedStep = clampOnboardingStep(step, ONBOARDING_STEP_DETAILS.length);
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
        try {
          if (result.tenant.id) {
            const billing = await fetchBillingStatus(result.tenant.id);
            if (billing.paymentsEnabled && billing.needsPayment) {
              window.location.assign(subscribePageUrl({ workspace: result.tenant.slug }));
              return;
            }
          }
        } catch {
          // Fall through to dashboard; SubscriptionGate catches unpaid workspaces.
        }
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
  const currentStep = ONBOARDING_STEP_DETAILS[normalizedStep];
  const CurrentStepIcon = currentStep.icon;

  const canContinue =
    normalizedStep === 0
      ? canContinueStep0
      : normalizedStep === 1
        ? firstName.trim().length >= 1 && lastName.trim().length >= 1 && jobTitle.trim().length >= 2
        : normalizedStep === 2
          ? Boolean(selectedPlan) && !pricingPreview.isLoading
          : true;

  const handleNext = () => {
    if (normalizedStep < ONBOARDING_STEPS.length - 1) {
      onStepChange(normalizedStep + 1);
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
    <div className="min-w-0 w-full xl:h-full">
      <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/76 p-3 shadow-[0_40px_120px_-72px_rgba(15,23,42,0.42)] backdrop-blur-xl sm:p-3.5 lg:h-full lg:p-4">
        <div
          aria-hidden="true"
          className="absolute inset-x-10 top-3 h-24 rounded-full bg-[#00a070]/16 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -right-24 top-24 h-56 w-56 rounded-full border border-white/30 bg-white/30 blur-3xl"
        />

        <div className="relative flex min-w-0 flex-col gap-3 lg:h-full">
          <div className="relative overflow-hidden rounded-[22px] border border-emerald-100/80 bg-[linear-gradient(135deg,rgba(236,249,242,0.98)_0%,rgba(255,255,255,0.96)_48%,rgba(239,252,247,0.98)_100%)] p-3.5 sm:p-4">
            <div
              aria-hidden="true"
              className="absolute -right-12 top-0 h-36 w-36 rounded-full bg-[#00a070]/14 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="absolute bottom-0 left-10 h-28 w-28 rounded-full bg-white/70 blur-3xl"
            />

            <div className="relative flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 space-y-2">
                <span className="inline-flex rounded-full border border-emerald-200/80 bg-white/72 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.25)]">
                  Step {normalizedStep + 1} of {ONBOARDING_STEP_DETAILS.length}
                </span>
                <div>
                  <h2 className="text-[clamp(1.35rem,1.8vw,1.8rem)] font-semibold tracking-[-0.05em] text-slate-950">
                    {currentStep.title}
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-500">
                    {currentStep.description}
                  </p>
                </div>
              </div>

              <div className="flex w-full items-center gap-2.5 rounded-[16px] border border-white/85 bg-white/78 px-3 py-2 shadow-[0_20px_45px_-34px_rgba(15,23,42,0.28)] sm:w-auto sm:self-start">
                <div className="flex size-9 items-center justify-center rounded-[12px] bg-[#00a070]/10 text-primary">
                  <CurrentStepIcon className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Current section
                  </p>
                  <p className="text-sm font-semibold text-slate-900">{currentStep.label}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200/80 bg-white/92 p-3.5 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.18)] sm:p-4 lg:flex lg:flex-1 lg:flex-col lg:p-4">
            {normalizedStep === 0 ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="company-name" className={fieldLabelClass}>
                    Company name
                  </Label>
                  <Input
                    id="company-name"
                    placeholder="Acme Inc."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="workspace-slug" className={fieldLabelClass}>
                    Workspace slug
                  </Label>
                  <div className="overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_10px_30px_-28px_rgba(15,23,42,0.45)] focus-within:ring-[3px] focus-within:ring-emerald-500/18">
                    <div className="flex min-w-0 flex-col sm:flex-row">
                      <span className="flex min-w-0 items-center border-b border-slate-200 bg-slate-50/90 px-4 py-2.5 text-xs leading-5 text-slate-500 break-all sm:border-b-0 sm:border-r sm:py-0 sm:text-sm">
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
                        className="h-10 min-w-0 flex-1 border-0 bg-transparent px-4 text-[15px] text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:ring-0"
                        aria-describedby="workspace-slug-hint"
                      />
                      {appUrlSuffix ? (
                        <span className="flex min-w-0 items-center border-t border-slate-200 bg-slate-50/90 px-4 py-2.5 text-xs leading-5 text-slate-500 break-all sm:border-l sm:border-t-0 sm:py-0 sm:text-sm">
                          {appUrlSuffix}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p
                    id="workspace-slug-hint"
                    className={cn(
                      'flex items-center gap-1.5 text-[11px] leading-4',
                      slugCheckPending && 'text-slate-500',
                      slug.trim().length >= 2 &&
                        !slugCheckPending &&
                        slugAvailabilityQuery.data?.available &&
                        'text-emerald-600',
                      slugBlocked && 'text-destructive',
                      slug.trim().length >= 2 && !slugFormatValid && 'text-destructive',
                      slug.trim().length < 2 && 'text-slate-500',
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

                <div className="space-y-1.5">
                  <Label htmlFor="tenant-code" className={fieldLabelClass}>
                    Tenant Code
                  </Label>
                  <Input
                    id="tenant-code"
                    placeholder="e.g. EMP, ZPR"
                    value={employeeCode}
                    onChange={(e) => {
                      employeeCodeTouchedRef.current = true;
                      setEmployeeCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                    }}
                    maxLength={10}
                    className={inputClass}
                  />
                  <p
                    className={cn(
                      'text-[11px] leading-4',
                      !isEmployeeCodeValid && employeeCode.length > 0
                        ? 'text-destructive'
                        : 'text-slate-500',
                    )}
                  >
                    {!isEmployeeCodeValid && employeeCode.length > 0
                      ? 'Tenant code must be between 2 and 10 characters.'
                      : `Short identifier prefix for employee IDs (e.g., ${employeeCode || 'EMP'}001).`}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className={fieldLabelClass}>Industry</Label>
                    <Select value={industry} onValueChange={setIndustry}>
                      <SelectTrigger className={selectTriggerClass}>
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
                    <Label className={fieldLabelClass}>Company size</Label>
                    <Select value={companySize} onValueChange={setCompanySize}>
                      <SelectTrigger className={selectTriggerClass}>
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
            ) : null}

            {normalizedStep === 1 ? (
              <div className="space-y-3">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first-name" className={fieldLabelClass}>
                      First name
                    </Label>
                    <Input
                      id="first-name"
                      placeholder="Jane"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name" className={fieldLabelClass}>
                      Last name
                    </Label>
                    <Input
                      id="last-name"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preferred-name" className={fieldLabelClass}>
                    Preferred name <span className="font-medium text-slate-400">(optional)</span>
                  </Label>
                  <Input
                    id="preferred-name"
                    placeholder="What should we call you on the dashboard?"
                    value={preferredName}
                    onChange={(e) => setPreferredName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-title" className={fieldLabelClass}>
                    Job position
                  </Label>
                  <Input
                    id="job-title"
                    placeholder="Head of People"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            ) : null}

            {normalizedStep === 2 ? (
              <div className="space-y-4">
                {pricingPreview.isLoading ? (
                  <div className="flex min-h-[170px] items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50/80">
                    <Loader2 className="size-6 animate-spin text-slate-400" />
                  </div>
                ) : pricingPreview.isError || sortedPlans.length === 0 ? (
                  <p className="rounded-[22px] border border-destructive/20 bg-destructive/5 px-4 py-5 text-center text-sm text-destructive">
                    {pricingPreview.error instanceof Error
                      ? pricingPreview.error.message
                      : 'Unable to load plans. Refresh and try again.'}
                  </p>
                ) : (
                  <div className="grid gap-3.5 md:grid-cols-2 2xl:grid-cols-3">
                    {sortedPlans.map((plan) => {
                      const isSelected = selectedPlan === plan.plan.slug;
                      const compactHighlights =
                        getPlanCatalog(plan.plan.slug)
                          ?.highlights.filter((item) => !item.includes('payroll platform fee'))
                          .slice(0, 4) ?? [];
                      return (
                        <button
                          key={plan.plan.slug}
                          type="button"
                          className="group h-full text-left"
                          onClick={() => setSelectedPlan(plan.plan.slug)}
                        >
                          <PlanPricingCard
                            slug={plan.plan.slug}
                            name={plan.plan.name}
                            description={plan.plan.description}
                            currency={plan.currency}
                            pricePerSeat={plan.monthlyPrice}
                            highlights={compactHighlights}
                            isPopular={plan.plan.slug === 'growth'}
                            variant="onboarding"
                            className={cn(
                              'h-full border-white/80 transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_30px_54px_-36px_rgba(15,23,42,0.3)]',
                              isSelected &&
                                'ring-2 ring-primary shadow-[0_30px_70px_-42px_rgba(0,160,112,0.38)]',
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {normalizedStep === 3 ? (
              <div className="space-y-3.5">
                <dl className="grid gap-2 text-sm sm:grid-cols-2 2xl:grid-cols-3">
                  <ReviewRow label="Workspace name" value={name.trim() || '—'} />
                  <ReviewRow
                    label="Workspace URL"
                    value={slug.trim() ? formatWorkspaceUrl(slug.trim()) : '—'}
                  />
                  <ReviewRow label="Industry" value={industry || '—'} />
                  <ReviewRow
                    label="Team size"
                    value={companySize ? `${companySize} employees` : '—'}
                  />
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
                      selectedPlanDetails
                        ? `${selectedPlanDetails.plan.name} · 14-day free trial`
                        : '—'
                    }
                  />
                </dl>

                <p className="text-center text-[11px] leading-4 text-slate-500">
                  Payroll and automated payouts are included on every plan during your trial.
                </p>
              </div>
            ) : null}

            <div className="mt-4 flex flex-col-reverse gap-2.5 border-t border-slate-200/80 pt-3 sm:mt-auto sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                disabled={normalizedStep === 0 || completeMutation.isPending}
                onClick={() => onStepChange(normalizedStep - 1)}
                className={cn(
                  'h-10 rounded-[16px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.2)] hover:bg-slate-50',
                  normalizedStep === 0 && 'pointer-events-none opacity-0',
                )}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={!canContinue || completeMutation.isPending}
                onClick={handleNext}
                variant="brandSolid"
                className="min-h-10 rounded-[16px] px-5 py-2 text-center text-sm font-semibold whitespace-normal shadow-[0_22px_40px_-28px_var(--brand-shadow)] sm:h-10 sm:py-0 sm:whitespace-nowrap"
              >
                {normalizedStep === ONBOARDING_STEPS.length - 1
                  ? completeMutation.isPending
                    ? 'Creating workspace…'
                    : 'Start 14-day free trial'
                  : 'Continue'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
