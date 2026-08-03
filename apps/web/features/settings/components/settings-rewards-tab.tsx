'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, RefreshCw, Save, Trash2, Wallet, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ContentCard } from '@/components/content-card';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  SettingsFieldHint,
  SettingsSwitchRow,
} from '@/features/settings/components/settings-field-hint';
import { SettingsFormActions } from '@/features/settings/components/settings-form-actions';
import { useBillingOverview } from '@/hooks/queries/use-billing';
import {
  useCreateCustomReward,
  useCustomRewards,
  useDeleteCustomReward,
  useReloadlyCountries,
  useTenantWallet,
  useUpdateAutoTopupConfig,
  useWalletTopupCheckout,
} from '@/hooks/queries/use-rewards';
import { usePatchTenantSettings, useTenantSettings } from '@/hooks/queries/use-tenant-settings';
import { syncRewardsCatalog, WALLET_TOPUP_MAX_AMOUNT } from '@/lib/api/rewards';
import { PAQ_POINTS_NAME } from '@/lib/constants/paq-points';
import { formatPlanMoney } from '@/lib/format-plan-money';
import { tenantPath } from '@/lib/navigation/tenant-routes';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

const CHECKOUT_SANDBOX_DOCS: Record<'nomba' | 'monnify' | 'noah', string> = {
  nomba: 'https://developer.nomba.com/docs/products/accept-payment/sandbox-testing',
  monnify: 'https://developers.monnify.com/docs/test-cards',
  noah: 'https://docs.noah.com/',
};

const SANDBOX_DOC_URL = 'https://developer.nomba.com/docs/products/accept-payment/sandbox-testing';

export function SettingsRewardsTab() {
  const { tenant } = useTenant();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useTenantSettings();
  const { data: wallet } = useTenantWallet();
  const { data: reloadlyCountries = [] } = useReloadlyCountries();
  const { data: billingOverview } = useBillingOverview();
  const { data: customRewards = [], isLoading: rewardsLoading } = useCustomRewards();
  const patchSettings = usePatchTenantSettings();
  const createReward = useCreateCustomReward();
  const deleteReward = useDeleteCustomReward();

  const updateAutoTopupMutation = useUpdateAutoTopupConfig();
  const topupCheckout = useWalletTopupCheckout();

  const rewards = settings?.settings?.rewards;
  const defaultCatalogCountry = (tenant?.countryCode?.trim() || 'US').toUpperCase();
  const [exchangeRate, setExchangeRate] = useState('1');
  const [selectedCountries, setSelectedCountries] = useState<string[]>([defaultCatalogCountry]);
  const [selectValue, setSelectValue] = useState<string | undefined>(undefined);
  const [countrySearch, setCountrySearch] = useState('');

  const [airtimeEnabled, setAirtimeEnabled] = useState(true);
  const [giftCardsEnabled, setGiftCardsEnabled] = useState(true);
  const [giftCardCategories, setGiftCardCategories] = useState<string[]>([
    'Gift Cards',
    'Gaming Cards',
    'Money Cards',
  ]);
  const [utilityPaymentsEnabled, setUtilityPaymentsEnabled] = useState(true);

  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPointsCost, setNewPointsCost] = useState('100');
  const [newInstructions, setNewInstructions] = useState('');

  // Top Up Modal State
  const [isTopupOpen, setIsTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');

  // Auto Top Up State
  const [autoTopupEnabled, setAutoTopupEnabled] = useState(false);
  const [autoTopupThreshold, setAutoTopupThreshold] = useState('1000');
  const [autoTopupAmount, setAutoTopupAmount] = useState('5000');

  const hasBillingCard = billingOverview?.hasPaymentMethodOnFile ?? false;
  const savedCardTopupSupported = wallet?.savedCardTopupSupported ?? true;
  const billingSettingsHref = tenant?.slug ? tenantPath(tenant.slug, 'settings?tab=billing') : null;
  const tenantCountry = (tenant?.countryCode ?? 'US').toUpperCase();
  const rewardsCurrency = (wallet?.currencyCode ?? 'USD').toUpperCase();
  const currencyLocked = wallet?.currencyLocked ?? Number(wallet?.balanceAmount ?? 0) !== 0;
  const isNgTenant = tenantCountry === 'NG';
  const topupAmountValue = Number(topupAmount);
  const topupAmountValid =
    Number.isFinite(topupAmountValue) &&
    topupAmountValue > 0 &&
    topupAmountValue <= WALLET_TOPUP_MAX_AMOUNT;
  const exchangeRateValue = Number(exchangeRate);
  const exampleRewardCost = 1000;
  const examplePointsCost =
    Number.isFinite(exchangeRateValue) && exchangeRateValue > 0
      ? Math.ceil(exampleRewardCost * exchangeRateValue)
      : null;

  useEffect(() => {
    if (searchParams.get('wallet_topup') === 'done') {
      toast.success('Wallet will update shortly');
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.wallet });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.walletTransactions });
    }
  }, [searchParams, queryClient]);

  useEffect(() => {
    if (rewards) {
      setExchangeRate(String(rewards.pointsExchangeRate ?? 1));
      const countries = (rewards.catalogCountries ?? [])
        .map((code) => code?.trim().toUpperCase())
        .filter((code): code is string => Boolean(code));
      setSelectedCountries(countries.length ? countries : [defaultCatalogCountry]);
      setAirtimeEnabled(rewards.airtimeEnabled ?? true);
      setGiftCardsEnabled(rewards.giftCardsEnabled ?? true);
      setGiftCardCategories(
        rewards.giftCardCategories ?? ['Gift Cards', 'Gaming Cards', 'Money Cards'],
      );
      setUtilityPaymentsEnabled(rewards.utilityPaymentsEnabled ?? true);
      return;
    }
    setSelectedCountries([defaultCatalogCountry]);
  }, [rewards, defaultCatalogCountry]);

  useEffect(() => {
    if (wallet) {
      setAutoTopupEnabled(wallet.autoTopupEnabled ?? false);
      setAutoTopupThreshold(String(wallet.autoTopupThreshold ?? 0));
      setAutoTopupAmount(String(wallet.autoTopupAmount ?? 0));
    }
  }, [wallet]);

  if (isLoading || rewardsLoading) return <LoadingBlock />;

  const toggleCategory = (cat: string) => {
    if (giftCardCategories.includes(cat)) {
      setGiftCardCategories(giftCardCategories.filter((c) => c !== cat));
    } else {
      setGiftCardCategories([...giftCardCategories, cat]);
    }
  };

  const saveRewardsSettings = async () => {
    const rate = Number(exchangeRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      toast.error('Exchange rate must be greater than 0');
      return;
    }
    const prevCountries = rewards?.catalogCountries?.length
      ? rewards.catalogCountries
      : [defaultCatalogCountry];
    const countriesChanged =
      prevCountries.length !== selectedCountries.length ||
      [...prevCountries].sort().some((c, i) => c !== [...selectedCountries].sort()[i]);

    try {
      await patchSettings.mutateAsync({
        rewards: {
          enabled: true,
          pointsExchangeRate: rate,
          rewardsCurrency: rewardsCurrency,
          catalogCountries: selectedCountries,
          airtimeEnabled,
          giftCardsEnabled,
          giftCardCategories,
          utilityPaymentsEnabled,
          customRewardsEnabled: rewards?.customRewardsEnabled ?? true,
          reloadlyProducts: rewards?.reloadlyProducts ?? [],
        },
      });
      if (countriesChanged) {
        try {
          await syncRewardsCatalog();
        } catch {
          // Backend may have synced during settings save; don't fail the whole save flow.
        }
      }
      toast.success('Rewards settings saved successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    }
  };

  const handleCreateReward = async () => {
    if (!newTitle.trim()) return;
    try {
      await createReward.mutateAsync({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        pointsCost: Number(newPointsCost) || 100,
        deliveryInstructions: newInstructions.trim() || undefined,
      });
      setNewTitle('');
      setNewDescription('');
      setNewPointsCost('100');
      setNewInstructions('');
      toast.success('Custom reward perk created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create reward');
    }
  };

  const handleRemoveCountry = (code: string) => {
    setSelectedCountries(selectedCountries.filter((c) => c !== code));
  };

  const handleAddCountry = (code: string) => {
    setSelectValue(undefined);
    if (code && !selectedCountries.includes(code)) {
      setSelectedCountries([...selectedCountries, code]);
    }
  };

  const handleSaveAutoTopup = async () => {
    const threshold = Number(autoTopupThreshold) || 0;
    const amount = Number(autoTopupAmount) || 0;
    if (threshold > WALLET_TOPUP_MAX_AMOUNT || amount > WALLET_TOPUP_MAX_AMOUNT) {
      toast.error(`Amount cannot exceed ${WALLET_TOPUP_MAX_AMOUNT.toLocaleString()}`);
      return;
    }
    if (autoTopupEnabled && amount <= 0) {
      toast.error('Enter a valid auto top-up amount');
      return;
    }
    try {
      await updateAutoTopupMutation.mutateAsync({
        enabled: autoTopupEnabled,
        threshold,
        amount,
      });
      toast.success('Auto topup enabled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save auto-topup');
    }
  };

  const handleTopup = async () => {
    if (!Number.isFinite(topupAmountValue) || topupAmountValue <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (topupAmountValue > WALLET_TOPUP_MAX_AMOUNT) {
      toast.error(`Amount cannot exceed ${WALLET_TOPUP_MAX_AMOUNT.toLocaleString()}`);
      return;
    }
    if (!topupAmountValid) {
      toast.error('Enter a valid amount');
      return;
    }
    try {
      await topupCheckout.mutateAsync(topupAmountValue);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Top up failed');
    }
  };

  const allCountries = (
    reloadlyCountries.length
      ? reloadlyCountries
      : Array.from(new Set([...selectedCountries, defaultCatalogCountry])).map((code) => ({
          code,
          name: code,
        }))
  ).filter((country) => Boolean(country.code?.trim()));

  const filteredReloadlyCountries = allCountries.filter(
    (country) =>
      country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      country.code.toLowerCase().includes(countrySearch.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Wallet Card */}
      <ContentCard
        title="Rewards Wallet"
        description="Your tenant's internal wallet for funding gift card and airtime redemptions"
      >
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-indigo-50/40 to-violet-50/40 dark:from-indigo-950/20 dark:to-violet-950/20 p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                <Wallet className="size-7 animate-pulse" />
              </div>
              <div>
                <p className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground">
                  {formatPlanMoney(Number(wallet?.balanceAmount ?? 0), rewardsCurrency)}
                </p>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">
                  Available Balance
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setIsTopupOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl px-5 shadow-lg shadow-indigo-600/20 dark:shadow-none transition-all duration-200"
              >
                Top up
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Fund via Top up — card or bank transfer in checkout
            {isNgTenant
              ? ` (${wallet?.checkoutProviderLabel ?? 'Nomba/Monnify'}, ${rewardsCurrency}).`
              : ` (Noah, ${rewardsCurrency} wallet — you can pay in GBP or EUR at checkout).`}
            {!wallet?.checkoutLive ? (
              <>
                {' '}
                <a
                  href={
                    CHECKOUT_SANDBOX_DOCS[wallet?.checkoutProvider ?? 'nomba'] ?? SANDBOX_DOC_URL
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline underline-offset-2"
                >
                  Test payments
                </a>{' '}
                in sandbox mode.
              </>
            ) : null}
          </p>

          <div className="rounded-2xl border bg-background/50 p-5 space-y-4">
            {savedCardTopupSupported ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                      <RefreshCw className="size-4 text-indigo-600 dark:text-indigo-400" />
                      Auto-topup
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Charge your billing card when balance is low
                    </p>
                  </div>
                  <Switch
                    checked={autoTopupEnabled}
                    onCheckedChange={setAutoTopupEnabled}
                    className="data-[state=checked]:bg-indigo-600"
                  />
                </div>

                {autoTopupEnabled && !hasBillingCard ? (
                  <Alert>
                    <AlertTitle>Billing card required</AlertTitle>
                    <AlertDescription>
                      {billingSettingsHref ? (
                        <Link
                          href={billingSettingsHref}
                          className="font-medium underline underline-offset-2"
                        >
                          Add a card in Billing
                        </Link>
                      ) : (
                        'Add a card in Settings → Billing.'
                      )}
                    </AlertDescription>
                  </Alert>
                ) : null}

                {autoTopupEnabled && (
                  <div className="grid gap-4 sm:grid-cols-2 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="auto-topup-threshold"
                        className="text-xs font-semibold text-muted-foreground"
                      >
                        When below ({rewardsCurrency})
                      </label>
                      <Input
                        id="auto-topup-threshold"
                        type="number"
                        min={0}
                        max={WALLET_TOPUP_MAX_AMOUNT}
                        placeholder="e.g. 1000"
                        value={autoTopupThreshold}
                        onChange={(e) => setAutoTopupThreshold(e.target.value)}
                        className="rounded-xl h-10"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="auto-topup-amount"
                        className="text-xs font-semibold text-muted-foreground"
                      >
                        Top up amount ({rewardsCurrency})
                      </label>
                      <Input
                        id="auto-topup-amount"
                        type="number"
                        min={1}
                        max={WALLET_TOPUP_MAX_AMOUNT}
                        placeholder="e.g. 5000"
                        value={autoTopupAmount}
                        onChange={(e) => setAutoTopupAmount(e.target.value)}
                        className="rounded-xl h-10"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveAutoTopup}
                    disabled={updateAutoTopupMutation.isPending}
                    className="rounded-xl font-semibold border-indigo-100 hover:border-indigo-200 text-indigo-600 hover:bg-indigo-50/40 dark:border-indigo-950 dark:text-indigo-400 dark:hover:bg-indigo-950/20"
                  >
                    <Save className="size-3.5 mr-1.5" />
                    Save
                  </Button>
                </div>
              </>
            ) : (
              <Alert>
                <AlertTitle>Auto-topup unavailable</AlertTitle>
                <AlertDescription>
                  Saved-card auto-topup is not supported with{' '}
                  {wallet?.checkoutProviderLabel ?? 'your payment provider'}. Use checkout or bank
                  transfer to fund the wallet.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </ContentCard>

      {/* Rewards Configuration */}
      <ContentCard
        title="Rewards Configuration"
        description="Control the rewards system, exchange rates, and catalog"
      >
        <div className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <SettingsFieldHint
              label="Points Exchange Rate"
              hint={`Points per 1 ${rewardsCurrency} of cost after fees. Rates below 1 are allowed. Gift card list prices use the lowest amount × (1 + plan fee %) × this rate.`}
            >
              <div className="space-y-3">
                <Input
                  type="number"
                  step={0.01}
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  className="rounded-xl h-11"
                />
                <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                  {examplePointsCost == null ? (
                    'Enter a positive rate to preview the conversion.'
                  ) : (
                    <>
                      Preview: {formatPlanMoney(exampleRewardCost, rewardsCurrency)} costs{' '}
                      <span className="font-semibold text-foreground">
                        {examplePointsCost.toLocaleString()} {PAQ_POINTS_NAME}
                      </span>{' '}
                      at a rate of {exchangeRateValue}.
                    </>
                  )}
                </div>
              </div>
            </SettingsFieldHint>

            <SettingsFieldHint
              label="Rewards Currency"
              hint={
                currencyLocked
                  ? `Locked after wallet activity. Balance stays in ${rewardsCurrency}.`
                  : isNgTenant
                    ? 'Nigeria workspaces use NGN and Nomba/Monnify. Updates if you change workspace settings before first top-up.'
                    : 'Set from workspace country and currency. Updates before first top-up if you change them in Workspace settings.'
              }
            >
              <Input value={rewardsCurrency} readOnly className="rounded-xl h-11 bg-muted/30" />
            </SettingsFieldHint>

            <div className="sm:col-span-2 space-y-4 pt-4 border-t border-border/40">
              <h4 className="text-sm font-semibold text-foreground">
                Reward Categories Visibility
              </h4>
              <div className="space-y-4 rounded-2xl border bg-muted/5 p-5">
                <SettingsSwitchRow
                  id="airtimeEnabled"
                  label="Airtime & Mobile Data"
                  hint="Allow users to redeem points for mobile airtime and data bundles."
                  checked={airtimeEnabled}
                  onCheckedChange={setAirtimeEnabled}
                />

                <hr className="border-border/40" />

                <div className="space-y-2">
                  <SettingsSwitchRow
                    id="giftCardsEnabled"
                    label="Gift Cards & Prepaid Vouchers"
                    hint="Reloadly vouchers. Points = wholesale cost converted to your workspace currency, plus plan fee, then × exchange rate. Members pay more for higher amounts."
                    checked={giftCardsEnabled}
                    onCheckedChange={setGiftCardsEnabled}
                  />
                  {giftCardsEnabled && (
                    <div className="pl-6 pt-2 space-y-2 border-l-2 border-indigo-100 dark:border-indigo-950/60 ml-2 animate-in fade-in slide-in-from-left-2 duration-200">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Points on each card are a starting price (lowest amount). Your wallet is
                        charged the Reloadly wholesale cost (converted to your workspace currency)
                        plus plan fee when someone redeems.
                      </p>
                      <p className="text-xs font-semibold text-muted-foreground">
                        Enabled Gift Card Types:
                      </p>
                      <div className="flex flex-wrap gap-5">
                        {['Gift Cards', 'Gaming Cards', 'Money Cards'].map((cat) => (
                          <label
                            key={cat}
                            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={giftCardCategories.includes(cat)}
                              onChange={() => toggleCategory(cat)}
                              className="rounded border-border bg-background text-indigo-600 focus:ring-indigo-500/30"
                            />
                            <span>{cat}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <hr className="border-border/40" />

                <SettingsSwitchRow
                  id="utilityPaymentsEnabled"
                  label="Utility Bill Payments"
                  hint="Allow users to redeem points for electricity bills and internet/water utilities."
                  checked={utilityPaymentsEnabled}
                  onCheckedChange={setUtilityPaymentsEnabled}
                />
              </div>
            </div>

            <SettingsFieldHint
              label="Catalog Countries"
              hint="Select allowed countries for Reloadly catalog products. Default comes from the workspace country, then falls back to US."
              className="sm:col-span-2"
            >
              <div className="space-y-4 p-5 rounded-2xl border bg-muted/10">
                <div className="flex flex-wrap gap-2 min-h-8 items-center">
                  {selectedCountries.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">
                      No countries selected. Catalog will be empty.
                    </span>
                  ) : (
                    selectedCountries
                      .filter((code) => Boolean(code?.trim()))
                      .map((code) => {
                        const info = allCountries.find((country) => country.code === code) ?? {
                          name: code,
                        };
                        return (
                          <Badge
                            key={code}
                            variant="secondary"
                            className="text-xs font-bold py-1.5 pl-3 pr-2 flex items-center gap-2 border border-indigo-100 dark:border-indigo-950 bg-indigo-50/20 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 rounded-full"
                          >
                            <span>
                              {info.name} ({code})
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCountry(code)}
                              className="rounded-full p-0.5 hover:bg-muted-foreground/20 text-indigo-500/80 hover:text-indigo-600 transition-colors"
                            >
                              <X className="size-3" />
                            </button>
                          </Badge>
                        );
                      })
                  )}
                </div>

                <div className="pt-3 border-t flex flex-wrap justify-between items-center gap-3">
                  <span className="text-xs text-muted-foreground font-semibold">
                    Add more countries:
                  </span>
                  <div className="flex items-center gap-2">
                    <Select value={selectValue} onValueChange={handleAddCountry}>
                      <SelectTrigger className="w-[220px] h-10 text-xs font-semibold rounded-xl">
                        <SelectValue placeholder="Choose Country..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        <div className="p-2 border-b">
                          <Input
                            placeholder="Search countries..."
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            className="h-8 text-xs rounded-lg"
                          />
                        </div>
                        {filteredReloadlyCountries
                          .filter(
                            (country) =>
                              Boolean(country.code?.trim()) &&
                              !selectedCountries.includes(country.code),
                          )
                          .map((country) => (
                            <SelectItem key={country.code} value={country.code} className="text-xs">
                              {country.name} ({country.code})
                            </SelectItem>
                          ))}
                        {filteredReloadlyCountries.length === 0 && (
                          <div className="p-2 text-center text-xs text-muted-foreground">
                            No countries found
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </SettingsFieldHint>
          </div>
          <SettingsFormActions onSave={saveRewardsSettings} isPending={patchSettings.isPending} />
        </div>
      </ContentCard>

      {/* Custom Rewards */}
      <ContentCard
        title="Custom Rewards"
        description="Create company-specific rewards employees can claim"
      >
        <div className="space-y-4">
          <div className="grid gap-3">
            {customRewards.map((reward) => (
              <div
                key={reward.id}
                className="flex items-center justify-between rounded-xl border border-border/60 p-4 bg-background/50 hover:bg-muted/10 transition-colors"
              >
                <div>
                  <span className="font-semibold text-foreground">{reward.title}</span>
                  <span className="ml-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full">
                    {reward.pointsCost} {PAQ_POINTS_NAME}
                  </span>
                  {reward.description && (
                    <p className="text-xs text-muted-foreground mt-1">{reward.description}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteReward.mutateAsync(reward.id)}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg size-8 p-0"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-3.5 rounded-xl border border-dashed border-border/60 p-5 bg-muted/5 mt-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="size-4 text-indigo-600" />
              Add New Custom Reward
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Reward title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="rounded-xl h-10"
              />
              <Input
                type="number"
                placeholder="Points cost"
                value={newPointsCost}
                onChange={(e) => setNewPointsCost(e.target.value)}
                className="rounded-xl h-10"
              />
            </div>
            <Textarea
              placeholder="Description (optional)"
              rows={2}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="rounded-xl"
            />
            <Input
              placeholder="Delivery instructions (optional)"
              value={newInstructions}
              onChange={(e) => setNewInstructions(e.target.value)}
              className="rounded-xl h-10"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={createReward.isPending || !newTitle.trim()}
                onClick={handleCreateReward}
                className="rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Add Reward
              </Button>
            </div>
          </div>
        </div>
      </ContentCard>

      <Dialog
        open={isTopupOpen}
        onOpenChange={(open) => {
          setIsTopupOpen(open);
          if (!open) setTopupAmount('');
        }}
      >
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="size-5 text-indigo-600" />
              Top up
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <label htmlFor="topup-amount" className="text-sm font-medium">
                Amount ({rewardsCurrency})
              </label>
              <Input
                id="topup-amount"
                type="number"
                min={1}
                max={WALLET_TOPUP_MAX_AMOUNT}
                step="1"
                placeholder="e.g. 5000"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                className="rounded-xl h-10"
              />
            </div>

            <Button
              type="button"
              disabled={!topupAmountValid || topupCheckout.isPending}
              onClick={() => void handleTopup()}
              className="rounded-xl font-semibold w-full"
            >
              {topupCheckout.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Redirecting…
                </>
              ) : (
                'Top up'
              )}
            </Button>

            {!wallet?.checkoutLive ? (
              <p className="text-xs text-muted-foreground">
                <a
                  href={
                    CHECKOUT_SANDBOX_DOCS[wallet?.checkoutProvider ?? 'nomba'] ?? SANDBOX_DOC_URL
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline underline-offset-2"
                >
                  Test payments
                </a>{' '}
                in sandbox mode
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
