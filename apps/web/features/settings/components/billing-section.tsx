'use client';

import { AlertTriangle, CheckCircle2, CreditCard, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlanPricingCard } from '@/features/billing/components/plan-pricing-card';
import { SettingsFieldHint } from '@/features/settings/components/settings-field-hint';
import { SettingsFormActions } from '@/features/settings/components/settings-form-actions';
import {
  useBillingOverview,
  useCancelSubscription,
  useCreateSubscriptionCheckout,
  useResumeSubscription,
  useUpdatePaymentMethod,
} from '@/hooks/queries/use-billing';
import { usePatchTenantSettings } from '@/hooks/queries/use-tenant-settings';
import type { BillingSettings } from '@/lib/api/tenant-settings';
import { sortPlansByTier } from '@/lib/constants/plan-catalog';
import { formatDate } from '@/lib/format-date';
import { formatPlanMoney } from '@/lib/format-plan-money';
import { subscribePageUrl } from '@/lib/navigation/tenant-routes';
import { useTenant } from '@/providers/tenant-provider';

function formatMoney(amount: number, currency: string) {
  return formatPlanMoney(amount, currency);
}

function BillingContactForm({
  initial,
  ownerEmail,
  canEdit,
}: {
  initial: BillingSettings;
  ownerEmail?: string | null;
  canEdit: boolean;
}) {
  const patchSettings = usePatchTenantSettings();
  const [contactName, setContactName] = useState(initial.contactName ?? '');
  const [contactEmail, setContactEmail] = useState(initial.contactEmail ?? ownerEmail ?? '');
  const [contactPhone, setContactPhone] = useState(initial.contactPhone ?? '');
  const [addressLine1, setAddressLine1] = useState(initial.addressLine1 ?? '');
  const [addressLine2, setAddressLine2] = useState(initial.addressLine2 ?? '');
  const [city, setCity] = useState(initial.city ?? '');
  const [country, setCountry] = useState(initial.country ?? '');
  const [identityBvn, setIdentityBvn] = useState('');
  const [identityNin, setIdentityNin] = useState('');
  const [showIdentity, setShowIdentity] = useState(false);

  useEffect(() => {
    setContactName(initial.contactName ?? '');
    setContactEmail(initial.contactEmail ?? ownerEmail ?? '');
    setContactPhone(initial.contactPhone ?? '');
    setAddressLine1(initial.addressLine1 ?? '');
    setAddressLine2(initial.addressLine2 ?? '');
    setCity(initial.city ?? '');
    setCountry(initial.country ?? '');
    setIdentityBvn('');
    setIdentityNin('');
  }, [initial, ownerEmail]);

  const save = async () => {
    if (!contactEmail.trim()) {
      toast.error('Billing contact email is required');
      return;
    }
    try {
      await patchSettings.mutateAsync({
        billing: {
          contactName: contactName.trim() || undefined,
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim() || undefined,
          addressLine1: addressLine1.trim() || undefined,
          addressLine2: addressLine2.trim() || undefined,
          city: city.trim() || undefined,
          country: country.trim() || undefined,
          identityBvn: identityBvn.trim() || undefined,
          identityNin: identityNin.trim() || undefined,
        },
      });
      toast.success('Billing contact saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save billing contact');
    }
  };

  if (!canEdit) {
    return (
      <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Contact</dt>
          <dd className="font-medium">{contactName || '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="font-medium">{contactEmail || '—'}</dd>
        </div>
      </dl>
    );
  }

  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <SettingsFieldHint label="Contact name">
        <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
      </SettingsFieldHint>
      <SettingsFieldHint label="Contact email">
        <Input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
        />
      </SettingsFieldHint>
      <SettingsFieldHint label="Phone">
        <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
      </SettingsFieldHint>
      <SettingsFieldHint label="Country">
        <Input value={country} onChange={(e) => setCountry(e.target.value)} />
      </SettingsFieldHint>
      <SettingsFieldHint label="Address line 1" className="sm:col-span-2">
        <Input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
      </SettingsFieldHint>
      <SettingsFieldHint label="Address line 2" className="sm:col-span-2">
        <Input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
      </SettingsFieldHint>
      <SettingsFieldHint label="City">
        <Input value={city} onChange={(e) => setCity(e.target.value)} />
      </SettingsFieldHint>
      <div className="sm:col-span-2 rounded-2xl border border-border/60 bg-muted/20 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">Identity verification (BVN / NIN)</p>
          {initial.hasIdentityBvn ? <Badge variant="secondary">BVN stored</Badge> : null}
          {initial.hasIdentityNin ? <Badge variant="secondary">NIN stored</Badge> : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Used for payroll compliance. Leave blank to keep existing values.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <SettingsFieldHint label="BVN">
            <div className="relative">
              <Input
                type={showIdentity ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={11}
                placeholder={initial.hasIdentityBvn ? 'Stored securely' : '11-digit BVN'}
                value={identityBvn}
                onChange={(e) => setIdentityBvn(e.target.value.replace(/\D/g, '').slice(0, 11))}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowIdentity(!showIdentity)}
                className="absolute right-0 top-0 flex h-full cursor-pointer items-center px-3 text-muted-foreground hover:text-foreground"
              >
                {showIdentity ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </SettingsFieldHint>
          <SettingsFieldHint label="NIN">
            <div className="relative">
              <Input
                type={showIdentity ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={11}
                placeholder={initial.hasIdentityNin ? 'Stored securely' : '11-digit NIN'}
                value={identityNin}
                onChange={(e) => setIdentityNin(e.target.value.replace(/\D/g, '').slice(0, 11))}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowIdentity(!showIdentity)}
                className="absolute right-0 top-0 flex h-full cursor-pointer items-center px-3 text-muted-foreground hover:text-foreground"
              >
                {showIdentity ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </SettingsFieldHint>
        </div>
      </div>
      <div className="sm:col-span-2">
        <SettingsFormActions onSave={save} isPending={patchSettings.isPending} />
      </div>
    </div>
  );
}

export function BillingSection() {
  const searchParams = useSearchParams();
  const { tenant } = useTenant();
  const { data: overview, isLoading, isError, error } = useBillingOverview();
  const checkout = useCreateSubscriptionCheckout();
  const updateCard = useUpdatePaymentMethod();
  const cancelSub = useCancelSubscription();
  const resumeSub = useResumeSubscription();
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('billing') === 'success') {
      setSuccessMessage('Payment received. Your plan will update shortly.');
    }
    if (searchParams.get('billing') === 'card-updated') {
      setSuccessMessage('Payment method updated successfully.');
    }
  }, [searchParams]);

  const sortedPlans = useMemo(() => sortPlansByTier(overview?.plans ?? []), [overview?.plans]);
  const billingHistory = overview?.billingHistory ?? [];

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading billing details…</p>;
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load billing</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Something went wrong'}
        </AlertDescription>
      </Alert>
    );
  }

  if (!overview) {
    return null;
  }

  const currentPlanSlug = overview.subscription?.plan?.toLowerCase();
  const payNowPlanSlug = currentPlanSlug ?? sortedPlans[0]?.slug ?? 'starter';
  const subStatus = overview.subscription?.status;
  const isPastDue = subStatus === 'PAST_DUE';
  const isActive =
    subStatus === 'ACTIVE' ||
    subStatus === 'PAUSED' ||
    (subStatus === 'TRIAL' && Boolean(overview.hasPaymentMethodOnFile));
  const isCancelledOrExpired =
    subStatus === 'CANCELLED' || subStatus === 'EXPIRED' || subStatus === 'SUSPENDED';
  const supportsCardUpdate = overview.supportsCardUpdate !== false;
  const canManageSub =
    overview.canManageBilling &&
    overview.paymentsEnabled &&
    Boolean(overview.subscription) &&
    subStatus !== 'CANCELLED';

  const paymentMethodLabel =
    overview.paymentMethodBrand && overview.paymentMethodLastFour
      ? `${overview.paymentMethodBrand} •••• ${overview.paymentMethodLastFour}`
      : overview.hasPaymentMethodOnFile
        ? 'Card on file'
        : 'None on file';

  const handleCheckout = async (planSlug: string) => {
    setCheckoutPlan(planSlug);
    try {
      const result = await checkout.mutateAsync({ planSlug });
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start checkout');
    } finally {
      setCheckoutPlan(null);
    }
  };

  const goToSubscribe = () => {
    if (!tenant?.slug) return;
    window.location.assign(subscribePageUrl({ workspace: tenant.slug }));
  };

  return (
    <div className="space-y-5">
      {successMessage ? (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      {overview.pricingMismatch ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Billing currency mismatch</AlertTitle>
          <AlertDescription>{overview.pricingMismatch.message}</AlertDescription>
        </Alert>
      ) : null}

      {isPastDue && overview.lastPaymentFailureReason ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Payment failed</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{overview.lastPaymentFailureReason}</p>
            {overview.dunningNextRetryAt ? (
              <p className="text-xs">
                We&apos;ll retry on {formatDate(overview.dunningNextRetryAt)}.
              </p>
            ) : null}
            {overview.canManageBilling ? (
              <div className="flex flex-wrap gap-2">
                {supportsCardUpdate ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={updateCard.isPending}
                    onClick={() => updateCard.mutate()}
                  >
                    {updateCard.isPending ? (
                      <>
                        <Loader2 className="mr-1 size-4 animate-spin" />
                        Redirecting…
                      </>
                    ) : (
                      'Update card'
                    )}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  disabled={checkout.isPending}
                  onClick={() => handleCheckout(payNowPlanSlug)}
                >
                  Retry payment
                </Button>
              </div>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {overview.needsPayment && overview.paymentsEnabled && !isPastDue ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Payment required</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>Your workspace needs an active subscription to continue without interruption.</p>
            {overview.canManageBilling ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={checkout.isPending}
                  onClick={() => handleCheckout(payNowPlanSlug)}
                >
                  {checkout.isPending ? (
                    <>
                      <Loader2 className="mr-1 size-4 animate-spin" />
                      Redirecting…
                    </>
                  ) : (
                    'Pay now'
                  )}
                </Button>
                {isCancelledOrExpired || !overview.subscription ? (
                  <Button size="sm" variant="outline" onClick={goToSubscribe}>
                    Choose a plan
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-xs">Ask a workspace admin to complete payment.</p>
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {overview.cancelAtPeriodEnd && overview.subscription?.currentPeriodEnd ? (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>Cancellation scheduled</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              Access continues until {formatDate(overview.subscription.currentPeriodEnd)}. After
              that the workspace will require a new plan.
            </p>
            {canManageSub ? (
              <Button
                size="sm"
                disabled={resumeSub.isPending}
                onClick={() =>
                  resumeSub.mutate(undefined, {
                    onSuccess: () => toast.success('Cancellation undone'),
                    onError: (err) =>
                      toast.error(
                        err instanceof Error ? err.message : 'Failed to undo cancellation',
                      ),
                  })
                }
              >
                {resumeSub.isPending ? (
                  <>
                    <Loader2 className="mr-1 size-4 animate-spin" />
                    Undoing…
                  </>
                ) : (
                  'Undo cancellation'
                )}
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-lg border border-border/60 p-4">
        <p className="text-sm font-medium">Current subscription</p>
        {overview.subscription ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium capitalize">{overview.subscription.plan}</span>
            <Badge variant="secondary" className="capitalize">
              {overview.hasPaymentMethodOnFile && subStatus === 'TRIAL'
                ? 'Active'
                : overview.subscription.status}
            </Badge>
            {overview.cancelAtPeriodEnd && overview.subscription.currentPeriodEnd ? (
              <Badge variant="outline">
                Cancels {formatDate(overview.subscription.currentPeriodEnd)}
              </Badge>
            ) : null}
            {overview.subscription.daysRemaining != null &&
            subStatus === 'TRIAL' &&
            !overview.hasPaymentMethodOnFile ? (
              <span className="text-muted-foreground">
                · {overview.subscription.daysRemaining} trial days left
              </span>
            ) : null}
            {overview.hasPaymentMethodOnFile &&
            subStatus === 'TRIAL' &&
            overview.subscription.currentPeriodEnd ? (
              <span className="text-muted-foreground">
                · First charge {formatDate(overview.subscription.currentPeriodEnd)}
              </span>
            ) : null}
            {overview.subscription.currentPeriodEnd &&
            !(overview.hasPaymentMethodOnFile && subStatus === 'TRIAL') ? (
              <span className="text-muted-foreground">
                · Period ends {formatDate(overview.subscription.currentPeriodEnd)}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No active subscription.</p>
        )}
        {canManageSub ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {(isActive || isPastDue) && !overview.cancelAtPeriodEnd ? (
              <>
                {supportsCardUpdate ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updateCard.isPending}
                    onClick={() => updateCard.mutate()}
                  >
                    {updateCard.isPending ? (
                      <>
                        <Loader2 className="mr-1 size-4 animate-spin" />
                        Redirecting…
                      </>
                    ) : (
                      'Update card'
                    )}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={cancelSub.isPending}
                  onClick={() =>
                    cancelSub.mutate(
                      { atPeriodEnd: true },
                      {
                        onSuccess: () => toast.success('Subscription will cancel at period end'),
                        onError: (err) =>
                          toast.error(err instanceof Error ? err.message : 'Failed to cancel'),
                      },
                    )
                  }
                >
                  Cancel subscription
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-border/60 p-4">
        <p className="text-sm font-medium">Billing contact</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Who receives invoices and billing correspondence for this workspace.
        </p>
        <BillingContactForm
          initial={overview.billingContact ?? {}}
          ownerEmail={overview.ownerEmail}
          canEdit={overview.canManageBilling}
        />
      </div>

      <div className="rounded-lg border border-border/60 p-4">
        <p className="text-sm font-medium">Billing information</p>
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Company</dt>
            <dd className="font-medium">{overview.companyName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Billing email</dt>
            <dd className="font-medium">
              {overview.billingContact?.contactEmail ?? overview.ownerEmail ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Billing region</dt>
            <dd className="font-medium">{overview.countryCode}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Currency</dt>
            <dd className="font-medium">{overview.currency}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Seats</dt>
            <dd className="font-medium">{overview.seatCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Next billing date</dt>
            <dd className="font-medium">
              {overview.nextBillingDate ? formatDate(overview.nextBillingDate) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Payment method</dt>
            <dd className="font-medium">{paymentMethodLabel}</dd>
          </div>
        </dl>
      </div>

      {billingHistory.length > 0 ? (
        <div className="rounded-lg border border-border/60">
          <p className="border-b border-border/60 px-4 py-3 text-sm font-medium">Invoices</p>
          <div className="divide-y divide-border/60">
            {billingHistory.map((entry) => (
              <div
                key={entry.invoiceId ?? entry.date}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{formatDate(entry.date)}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.invoiceId ?? 'No reference'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span>{formatMoney(entry.amount, entry.currency)}</span>
                  <Badge variant={entry.status === 'paid' ? 'secondary' : 'outline'}>
                    {entry.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No invoices yet.</p>
      )}

      {!overview.paymentsEnabled ? (
        <p className="text-xs text-muted-foreground">
          Online billing is not enabled for this environment.
        </p>
      ) : null}

      {sortedPlans.length > 0 ? (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CreditCard className="size-4 text-primary" />
            Plans
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {sortedPlans.map((plan) => {
              const isCurrent = currentPlanSlug === plan.slug;
              const isPending = checkoutPlan === plan.slug && checkout.isPending;
              const perSeat = plan.breakdown.basePrice / Math.max(1, plan.seatCount);

              return (
                <PlanPricingCard
                  key={plan.planPriceId}
                  slug={plan.slug}
                  name={plan.name}
                  description={plan.description}
                  currency={plan.currency}
                  pricePerSeat={perSeat}
                  seatCount={plan.seatCount}
                  monthlyTotal={plan.monthlyTotal}
                  maxEmployees={plan.limits.maxEmployees}
                  isPopular={plan.slug === 'growth'}
                  isCurrent={isCurrent}
                  action={
                    overview.canManageBilling ? (
                      <Button
                        className="w-full"
                        size="sm"
                        variant={isCurrent ? 'secondary' : 'default'}
                        disabled={isCurrent || isPending}
                        onClick={() => handleCheckout(plan.slug)}
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Redirecting…
                          </>
                        ) : isCurrent ? (
                          'Current plan'
                        ) : overview.subscription?.status === 'ACTIVE' ? (
                          `Switch to ${plan.name}`
                        ) : (
                          'Subscribe'
                        )}
                      </Button>
                    ) : null
                  }
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
