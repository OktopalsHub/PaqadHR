'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, RefreshCw, Save, Trash2, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ContentCard } from '@/components/content-card';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { getDefaultPayrollCurrencyForCountry } from '@/features/settings/lib/workspace-payroll-currencies';
import { useBillingOverview } from '@/hooks/queries/use-billing';
import {
  useCreateCustomReward,
  useCustomRewards,
  useDeleteCustomReward,
  useTenantWallet,
  useUpdateAutoTopupConfig,
  useWalletTopupCheckout,
  WALLET_TOPUP_PENDING_KEY,
} from '@/hooks/queries/use-rewards';
import { usePatchTenantSettings, useTenantSettings } from '@/hooks/queries/use-tenant-settings';
import {
  completeWalletTopupCheckout,
  syncRewardsCatalog,
  WALLET_TOPUP_MAX_AMOUNT,
} from '@/lib/api/rewards';
import { PAQ_POINTS_NAME } from '@/lib/constants/paq-points';
import { formatPlanMoney } from '@/lib/format-plan-money';
import { tenantPath } from '@/lib/navigation/tenant-routes';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

function walletAmountExamples(currency: string) {
  const isNgn = currency.toUpperCase() === 'NGN';
  return {
    thresholdPlaceholder: isNgn ? 'e.g. 1000' : 'e.g. 50',
    amountPlaceholder: isNgn ? 'e.g. 5000' : 'e.g. 100',
  };
}

export function SettingsRewardsTab() {
  const { tenant, tenantId } = useTenant();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useTenantSettings();
  const { data: wallet } = useTenantWallet();
  const { data: billingOverview } = useBillingOverview();
  const { data: customRewards = [], isLoading: rewardsLoading } = useCustomRewards();
  const patchSettings = usePatchTenantSettings();
  const createReward = useCreateCustomReward();
  const deleteReward = useDeleteCustomReward();

  const updateAutoTopupMutation = useUpdateAutoTopupConfig();
  const topupCheckout = useWalletTopupCheckout();

  const isNgTenant = (tenant?.countryCode ?? '').toUpperCase() === 'NG';
  const rewards = settings?.settings?.rewards;
  const [exchangeRate, setExchangeRate] = useState('1');
  const [airtimeEnabled, setAirtimeEnabled] = useState(true);
  const [giftCardsEnabled, setGiftCardsEnabled] = useState(true);
  const [giftCardProvider, setGiftCardProvider] = useState<'reloadly' | 'tremendous'>('tremendous');
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
  const rewardsCurrency = (
    wallet?.currencyCode ??
    tenant?.preferredCurrency ??
    getDefaultPayrollCurrencyForCountry(tenant?.countryCode)
  ).toUpperCase();
  const { thresholdPlaceholder, amountPlaceholder } = walletAmountExamples(rewardsCurrency);
  const topupAmountValue = Number(topupAmount);
  const topupAmountValid =
    Number.isFinite(topupAmountValue) &&
    topupAmountValue > 0 &&
    topupAmountValue <= WALLET_TOPUP_MAX_AMOUNT;

  useEffect(() => {
    if (!tenantId) return;

    let cancelled = false;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const run = async () => {
      const walletTopupDone = searchParams.get('wallet_topup') === 'done';
      let orderReference =
        searchParams.get('paymentReference') || searchParams.get('paymentreference') || '';
      let transactionReference =
        searchParams.get('transactionReference') || searchParams.get('transactionreference') || '';
      let pendingAmount: number | undefined;
      let hasPending = false;

      try {
        const raw = sessionStorage.getItem(WALLET_TOPUP_PENDING_KEY);
        if (raw) {
          const pending = JSON.parse(raw) as {
            tenantId?: string;
            orderReference?: string;
            transactionReference?: string;
            amount?: number;
          };
          if (pending.orderReference && (!pending.tenantId || pending.tenantId === tenantId)) {
            hasPending = true;
            orderReference = orderReference || pending.orderReference;
            transactionReference = transactionReference || pending.transactionReference || '';
            if (Number.isFinite(pending.amount) && (pending.amount as number) > 0) {
              pendingAmount = Number(pending.amount);
            }
          }
        }
      } catch {
        // ignore
      }

      // Monnify may rewrite the redirect query and drop wallet_topup=done — still complete from session / paymentReference.
      const looksLikeMonnifyRef = /^wm_[0-9a-f]{32}_/i.test(orderReference);
      if (!walletTopupDone && !hasPending && !looksLikeMonnifyRef) {
        return;
      }

      if (!orderReference) {
        if (walletTopupDone) {
          toast.message('If you completed payment, your wallet will update shortly.');
          void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.wallet });
          void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.walletTransactions });
        }
        return;
      }

      try {
        // Monnify redirect can arrive before PAID is queryable — poll verify a few times.
        let result: { credited: boolean; retryable?: boolean } = {
          credited: false,
          retryable: true,
        };
        for (let attempt = 0; attempt < 6; attempt++) {
          result = await completeWalletTopupCheckout(
            tenantId,
            orderReference,
            pendingAmount,
            transactionReference || undefined,
          );
          if (cancelled) return;
          if (result.credited || !result.retryable) break;
          await sleep(2000);
        }
        if (cancelled) return;
        try {
          sessionStorage.removeItem(WALLET_TOPUP_PENDING_KEY);
        } catch {
          // ignore
        }
        if (result.credited) {
          toast.success('Wallet topped up');
          void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.wallet });
          void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.walletTransactions });
        } else if (walletTopupDone || hasPending) {
          toast.message('Payment is still processing. Your wallet will update shortly.');
          void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.wallet });
        }
      } catch {
        if (cancelled) return;
        toast.message('Payment is still processing. Your wallet will update shortly.');
        void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.wallet });
        void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.walletTransactions });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [searchParams, queryClient, tenantId]);

  useEffect(() => {
    if (rewards) {
      setExchangeRate(String(rewards.pointsExchangeRate ?? 1));
      setAirtimeEnabled(rewards.airtimeEnabled ?? true);
      setGiftCardsEnabled(rewards.giftCardsEnabled ?? true);
      setGiftCardProvider(rewards.giftCardProvider === 'reloadly' ? 'reloadly' : 'tremendous');
      setGiftCardCategories(
        rewards.giftCardCategories ?? ['Gift Cards', 'Gaming Cards', 'Money Cards'],
      );
      setUtilityPaymentsEnabled(rewards.utilityPaymentsEnabled ?? true);
      return;
    }
  }, [rewards]);

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
    const prevProvider = rewards?.giftCardProvider === 'reloadly' ? 'reloadly' : 'tremendous';
    const providerChanged = prevProvider !== giftCardProvider;

    try {
      await patchSettings.mutateAsync({
        rewards: {
          enabled: true,
          pointsExchangeRate: rate,
          rewardsCurrency: rewardsCurrency,
          airtimeEnabled,
          giftCardsEnabled,
          giftCardCategories,
          giftCardProvider,
          utilityPaymentsEnabled,
          customRewardsEnabled: rewards?.customRewardsEnabled ?? true,
          reloadlyProducts: rewards?.reloadlyProducts ?? [],
          tremendousProducts: rewards?.tremendousProducts ?? [],
        },
      });
      if (providerChanged) {
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

  return (
    <div className="space-y-6">
      {/* Wallet Card */}
      <ContentCard title="Rewards Wallet">
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

          <div className="rounded-2xl border bg-background/50 p-5 space-y-4">
            {savedCardTopupSupported ? (
              <>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                    <RefreshCw className="size-4 text-indigo-600 dark:text-indigo-400" />
                    Auto-topup
                  </h4>
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
                        placeholder={thresholdPlaceholder}
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
                        placeholder={amountPlaceholder}
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
                  Saved-card auto-topup is not available for this workspace. Use Top up to fund the
                  wallet via checkout or bank transfer.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </ContentCard>

      {/* Rewards Configuration */}
      <ContentCard title="Rewards Configuration">
        <div className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <SettingsFieldHint label="Points Exchange Rate">
              <Input
                type="number"
                step={0.01}
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                className="rounded-xl h-11"
              />
            </SettingsFieldHint>

            <SettingsFieldHint label="Rewards Currency">
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
                  checked={airtimeEnabled}
                  onCheckedChange={setAirtimeEnabled}
                />

                <hr className="border-border/40" />

                <div className="space-y-2">
                  <SettingsSwitchRow
                    id="giftCardsEnabled"
                    label="Gift Cards & Prepaid Vouchers"
                    checked={giftCardsEnabled}
                    onCheckedChange={setGiftCardsEnabled}
                  />
                  {giftCardsEnabled && (
                    <div className="pl-6 pt-2 space-y-3 border-l-2 border-indigo-100 dark:border-indigo-950/60 ml-2 animate-in fade-in slide-in-from-left-2 duration-200">
                      {isNgTenant ? null : (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-muted-foreground">Provider</p>
                          <Select
                            value={giftCardProvider}
                            onValueChange={(value) =>
                              setGiftCardProvider(value === 'reloadly' ? 'reloadly' : 'tremendous')
                            }
                          >
                            <SelectTrigger className="w-[220px] h-10 text-xs font-semibold rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="tremendous" className="text-xs">
                                Tremendous
                              </SelectItem>
                              <SelectItem value="reloadly" className="text-xs">
                                Reloadly
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
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
                  checked={utilityPaymentsEnabled}
                  onCheckedChange={setUtilityPaymentsEnabled}
                />
              </div>
            </div>
          </div>
          <SettingsFormActions onSave={saveRewardsSettings} isPending={patchSettings.isPending} />
        </div>
      </ContentCard>

      {/* Custom Rewards */}
      <ContentCard title="Custom Rewards">
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
                placeholder={amountPlaceholder}
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
