'use client';

import {
  Check,
  Gift,
  Loader2,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Trophy,
  Wallet,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppPage } from '@/components/app-page';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  useAllClaims,
  useClaimReward,
  useCreateCustomReward,
  useDeleteCustomReward,
  useMyClaims,
  useNombaDataPlans,
  useRewardProviders,
  useRewardsCatalog,
  useUtilityBillers,
} from '@/hooks/queries/use-rewards';
import { useMyPointsBalance } from '@/hooks/queries/use-shoutouts';
import { useTenantSettings } from '@/hooks/queries/use-tenant-settings';
import {
  type CatalogItem,
  calculatePointsCost,
  lookupUtilityMeter,
  type RewardRedemption,
} from '@/lib/api/rewards';
import { PAQ_POINTS_NAME } from '@/lib/constants/paq-points';
import { cn } from '@/lib/utils';
import { mapMemberWalletError } from '@/lib/wallet-error-message';
import { useTenant } from '@/providers/tenant-provider';
import { CatalogCard } from './rewards-page-catalog-card';
import {
  dataPlanId,
  getAvailableCustomPerkTemplates,
  getGiftCardCategory,
} from './rewards-page-catalog-utils';
import { ClaimRow } from './rewards-page-claim-row';
import { PointsSummaryCard } from './rewards-page-points-summary';

function catalogCountryLabel(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

function createClaimIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function RewardsPage({ isTab = false }: { isTab?: boolean } = {}) {
  const { tenant } = useTenant();
  const { data: tenantSettings } = useTenantSettings();
  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';
  const settings = tenantSettings?.settings?.rewards;
  const isNgWorkspace = (tenant?.countryCode ?? '').toUpperCase() === 'NG';
  const tenantCountry = (tenant?.countryCode ?? 'US').toUpperCase();
  const allowedCatalogCountries = Array.from(
    new Set([
      tenantCountry,
      ...(settings?.catalogCountries ?? []).map((code) => code.toUpperCase()),
    ]),
  );

  const isAirtimeEnabled = settings?.airtimeEnabled ?? true;
  const isGiftCardsEnabled = settings?.giftCardsEnabled ?? true;
  const isUtilitiesEnabled = settings?.utilityPaymentsEnabled ?? true;
  const { data: _providers, isLoading: _Loading } = useRewardProviders();
  const isNgAvailable = isNgWorkspace || allowedCatalogCountries.includes('NG');
  const redemptionCountry = isNgAvailable ? 'NG' : tenantCountry;
  const showAirtime = isAirtimeEnabled && isNgAvailable;
  const showUtilities = isUtilitiesEnabled && isNgAvailable;

  const [catalogCountryCode, setCatalogCountryCode] = useState(tenantCountry);
  const { data: pointsBalance, isLoading: pointsLoading } = useMyPointsBalance();
  const { data: catalog = [], isLoading: catalogLoading } = useRewardsCatalog(catalogCountryCode);
  const { data: claims = [], isLoading: claimsLoading } = useMyClaims();
  const { data: allClaims = [], isLoading: allClaimsLoading } = useAllClaims();
  const claimReward = useClaimReward();

  const createCustomReward = useCreateCustomReward();
  const deleteCustomReward = useDeleteCustomReward();

  // Top-up (Airtime/Data) States
  const [selectedCountryCode, setSelectedCountryCode] = useState(redemptionCountry);
  const [airtimePhone, setAirtimePhone] = useState('');
  const [airtimeNetwork, setAirtimeNetwork] = useState<'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE'>('MTN');
  const [airtimeAmount, setAirtimeAmount] = useState('1000');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [topupMode, setTopupMode] = useState<'airtime' | 'data'>('airtime');
  const [selectedBundleId, setSelectedBundleId] = useState<string>('');
  const defaultTab = showAirtime ? 'airtime' : showUtilities ? 'utilities' : 'perks';
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    const visibleTabs: string[] = [];
    if (showAirtime) visibleTabs.push('airtime');
    if (showUtilities) visibleTabs.push('utilities');
    visibleTabs.push('perks');
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0] ?? 'perks');
    }
  }, [showAirtime, showUtilities, activeTab]);
  const { data: nombaDataPlans = [], isLoading: dataPlansLoading } = useNombaDataPlans(
    airtimeNetwork,
    selectedCountryCode === 'NG' && topupMode === 'data',
  );

  const selectedDataPlan = nombaDataPlans.find((plan) => dataPlanId(plan) === selectedBundleId);

  // Sync selected country code if settings change
  useEffect(() => {
    if (selectedCountryCode !== redemptionCountry) {
      setSelectedCountryCode(redemptionCountry);
    }
  }, [redemptionCountry, selectedCountryCode]);

  useEffect(() => {
    if (!allowedCatalogCountries.includes(catalogCountryCode)) {
      setCatalogCountryCode(tenantCountry);
    }
  }, [allowedCatalogCountries, catalogCountryCode, tenantCountry]);

  useEffect(() => {
    if (topupMode !== 'data' || selectedCountryCode !== 'NG' || nombaDataPlans.length === 0) {
      return;
    }
    const first = nombaDataPlans[0];
    const id = dataPlanId(first);
    if (
      !selectedBundleId ||
      !nombaDataPlans.some((plan) => dataPlanId(plan) === selectedBundleId)
    ) {
      setSelectedBundleId(id);
      setAirtimeAmount(String(first.amount));
    }
  }, [nombaDataPlans, topupMode, selectedCountryCode, selectedBundleId]);

  // JIT Points calculation states for top-ups
  const [calculatedPoints, setCalculatedPoints] = useState<number | null>(null);
  const [_calculatedValue, setCalculatedValue] = useState<number | null>(null);
  const [calculatedCurrency, setCalculatedCurrency] = useState<string>('NGN');
  const [airtimeProcessingFee, setAirtimeProcessingFee] = useState<number | null>(null);
  const [isCalculatingPoints, setIsCalculatingPoints] = useState(false);
  const [pointsCalcError, setPointsCalcError] = useState<string | null>(null);

  useEffect(() => {
    const amt = Number(airtimeAmount) || 0;
    if (selectedCountryCode === 'NG') {
      if (amt >= 100) {
        const delayDebounceFn = setTimeout(async () => {
          setIsCalculatingPoints(true);
          setPointsCalcError(null);
          try {
            const res = await calculatePointsCost({
              type: 'ng-airtime',
              billerId: 0,
              amount: amt,
            });
            setCalculatedPoints(res.pointsCost);
            setCalculatedValue(res.currencyValue);
            setCalculatedCurrency(res.currencyCode);
            setAirtimeProcessingFee(
              'processingFee' in res
                ? Number(res.processingFee)
                : res.totalTenantDebit - res.currencyValue,
            );
          } catch (e) {
            setCalculatedPoints(null);
            setAirtimeProcessingFee(null);
            setPointsCalcError(e instanceof Error ? e.message : 'Failed to calculate points cost');
          } finally {
            setIsCalculatingPoints(false);
          }
        }, 500);
        return () => clearTimeout(delayDebounceFn);
      }
      setCalculatedPoints(null);
      setAirtimeProcessingFee(null);
      setPointsCalcError(null);
      return;
    }

    setCalculatedPoints(null);
  }, [airtimeAmount, selectedCountryCode]);

  // Utility Bill States
  const [utilityCountryCode, setUtilityCountryCode] = useState(redemptionCountry);
  const [selectedUtilityBillerNg, setSelectedUtilityBillerNg] = useState('');
  const [utilityAccountNumber, setUtilityAccountNumber] = useState('');
  const [utilityAmount, setUtilityAmount] = useState('1000');
  const [utilityServiceType, setUtilityServiceType] = useState<'PREPAID' | 'POSTPAID'>('PREPAID');

  const { data: ngUtilityBillers = [], isLoading: ngBillersLoading } = useUtilityBillers(
    showUtilities && utilityCountryCode === 'NG' ? 'NG' : '',
  );

  const selectedNgUtilityBiller = ngUtilityBillers.find(
    (b) => String(b.id) === selectedUtilityBillerNg,
  );

  // Sync selected country code for utilities if settings change
  useEffect(() => {
    if (utilityCountryCode !== redemptionCountry) {
      setUtilityCountryCode(redemptionCountry);
    }
  }, [redemptionCountry, utilityCountryCode]);

  useEffect(() => {
    if (ngUtilityBillers.length === 0) return;
    if (
      !selectedUtilityBillerNg ||
      !ngUtilityBillers.some((b) => String(b.id) === selectedUtilityBillerNg)
    ) {
      setSelectedUtilityBillerNg(String(ngUtilityBillers[0].id));
    }
  }, [ngUtilityBillers, selectedUtilityBillerNg]);

  // Meter lookup/validation state
  const [isLookingUpMeter, setIsLookingUpMeter] = useState(false);
  const [lookupResult, setLookupResult] = useState<{
    customerName: string | null;
    meterNumber: string | null;
    address: string | null;
    billerId: string | null;
  } | null>(null);

  // Utility points calculation states
  const [utilityPoints, setUtilityPoints] = useState<number | null>(null);
  const [_utilityCalculatedValue, setUtilityCalculatedValue] = useState<number | null>(null);
  const [utilityCalculatedCurrency, setUtilityCalculatedCurrency] = useState<string>('NGN');
  const [utilityProcessingFee, setUtilityProcessingFee] = useState<number | null>(null);
  const [isCalculatingUtilityPoints, setIsCalculatingUtilityPoints] = useState(false);
  const [utilityCalcError, setUtilityCalcError] = useState<string | null>(null);

  useEffect(() => {
    const amt = Number(utilityAmount) || 0;
    if (utilityCountryCode === 'NG') {
      if (amt >= 100) {
        const delayDebounceFn = setTimeout(async () => {
          setIsCalculatingUtilityPoints(true);
          setUtilityCalcError(null);
          try {
            const res = await calculatePointsCost({
              type: 'ng-utility',
              billerId: 0,
              amount: amt,
            });
            setUtilityPoints(res.pointsCost);
            setUtilityCalculatedValue(res.currencyValue);
            setUtilityCalculatedCurrency(res.currencyCode);
            setUtilityProcessingFee(
              'processingFee' in res
                ? Number(res.processingFee)
                : res.totalTenantDebit - res.currencyValue,
            );
          } catch (e) {
            setUtilityPoints(null);
            setUtilityProcessingFee(null);
            setUtilityCalcError(e instanceof Error ? e.message : 'Failed to calculate points cost');
          } finally {
            setIsCalculatingUtilityPoints(false);
          }
        }, 500);
        return () => clearTimeout(delayDebounceFn);
      }
      setUtilityPoints(null);
      setUtilityProcessingFee(null);
      setUtilityCalcError(null);
      return;
    }

    if (amt > 0 && selectedNgUtilityBiller) {
      const delayDebounceFn = setTimeout(async () => {
        setIsCalculatingUtilityPoints(true);
        setUtilityCalcError(null);
        try {
          const res = await calculatePointsCost({
            type: 'ng-utility',
            billerId: Number(selectedNgUtilityBiller.id),
            amount: amt,
          });
          setUtilityPoints(res.pointsCost);
          setUtilityCalculatedValue(res.currencyValue);
          setUtilityCalculatedCurrency(res.currencyCode);
        } catch (e) {
          setUtilityPoints(null);
          setUtilityCalcError(e instanceof Error ? e.message : 'Failed to calculate points cost');
        } finally {
          setIsCalculatingUtilityPoints(false);
        }
      }, 500);
      return () => clearTimeout(delayDebounceFn);
    }
    setUtilityPoints(null);
  }, [utilityAmount, utilityCountryCode, selectedNgUtilityBiller?.id, selectedNgUtilityBiller]);

  const handleLookupMeter = async () => {
    if (!utilityAccountNumber.trim()) {
      toast.error('Please enter meter / account number');
      return;
    }
    setIsLookingUpMeter(true);
    setLookupResult(null);
    try {
      const billerId = selectedUtilityBillerNg;
      const res = await lookupUtilityMeter({
        countryCode: utilityCountryCode,
        billerId,
        accountNumber: utilityAccountNumber.trim(),
        serviceType: utilityServiceType,
      });
      setLookupResult(res);
      toast.success('Account / Meter verified successfully!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to verify account / meter');
    } finally {
      setIsLookingUpMeter(false);
    }
  };

  const handleUtilityClaim = async () => {
    if (!utilityAccountNumber.trim()) {
      toast.error('Enter recipient meter or account number.');
      return;
    }
    const amount = Number(utilityAmount);
    if (Number.isNaN(amount) || amount < 100) {
      toast.error('Minimum amount is 100');
      return;
    }

    if (!utilityPoints) {
      toast.error('Please calculate point cost first.');
      return;
    }

    if (pointsBalance && pointsBalance.currentBalance < utilityPoints) {
      toast.error(`Insufficient points. Needed: ${utilityPoints} ${PAQ_POINTS_NAME}`);
      return;
    }

    if (utilityCountryCode === 'NG' && !lookupResult) {
      toast.error('Please verify meter before claiming.');
      return;
    }

    setClaimingId('utility');
    const idempotencyKey = createClaimIdempotencyKey();
    try {
      const billerId = selectedUtilityBillerNg;
      const billerName = selectedNgUtilityBiller?.name;

      const rewardName = `${billerName} Utility Payment`;

      const result = await claimReward.mutateAsync({
        idempotencyKey,
        rewardType: 'NOMBA_UTILITY',
        rewardId: 'NOMBA_UTILITY',
        rewardName,
        pointsCost: utilityPoints,
        currencyValue: amount,
        currencyCode: utilityCalculatedCurrency,
        recipientPhone: undefined,
        billerId,
        accountNumber: utilityAccountNumber.trim(),
        serviceType: utilityServiceType,
      });

      if (result.status === 'SUCCESS') {
        toast.success(
          `Utility payment successful! ${result.voucher?.code ? `Token: ${result.voucher.code}` : ''}`,
        );
        setUtilityAccountNumber('');
        setLookupResult(null);
      } else if (result.status === 'FAILED') {
        toast.error(result.providerRef?.error ?? 'Payment failed. Points refunded.');
      }
    } catch (err) {
      toast.error(mapMemberWalletError(err, 'Failed to redeem utility payment'));
    } finally {
      setClaimingId(null);
    }
  };

  const [isAddingPerk, setIsAddingPerk] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPointsCost, setNewPointsCost] = useState('100');
  const [newInstructions, setNewInstructions] = useState('');

  const [selectedCategory, setSelectedCategory] = useState<
    'All' | 'Airtime' | 'Money Cards' | 'Gift Cards' | 'Gaming Cards'
  >('All');
  const [isAddingTemplateId, setIsAddingTemplateId] = useState<string | null>(null);

  const [claimsSearch, setClaimsSearch] = useState('');

  const giftCards = useMemo(() => catalog.filter((i) => i.type === 'TREMENDOUS'), [catalog]);
  const customPerks = useMemo(() => catalog.filter((i) => i.type === 'CUSTOM'), [catalog]);
  const availablePerkTemplates = useMemo(
    () => getAvailableCustomPerkTemplates(customPerks),
    [customPerks],
  );

  const filteredGiftCards = useMemo(
    () =>
      giftCards.filter((item) => {
        const category = getGiftCardCategory(item);
        const isNgAirtime = item.countryCode === 'NG' && category === 'Airtime';
        if (isNgAirtime) return false;
        if (selectedCategory === 'All') return true;
        return category === selectedCategory;
      }),
    [giftCards, selectedCategory],
  );

  const giftCardsForCounts = useMemo(
    () =>
      giftCards.filter((item) => {
        const category = getGiftCardCategory(item);
        const isNgAirtime = item.countryCode === 'NG' && category === 'Airtime';
        return !isNgAirtime;
      }),
    [giftCards],
  );

  const filteredAllClaims = useMemo(
    () =>
      allClaims.filter((claim) => {
        if (!claimsSearch.trim()) return true;
        const term = claimsSearch.trim().toLowerCase();
        const nameMatch = claim.rewardName?.toLowerCase().includes(term);
        const memberName = claim.member
          ? `${claim.member.firstName} ${claim.member.lastName}`.toLowerCase()
          : '';
        const phoneMatch = claim.recipient?.phone?.toLowerCase().includes(term);
        const emailMatch = claim.recipient?.email?.toLowerCase().includes(term);
        return nameMatch || memberName.includes(term) || phoneMatch || emailMatch;
      }),
    [allClaims, claimsSearch],
  );

  const handleClaim = async (item: CatalogItem) => {
    if (pointsBalance && pointsBalance.currentBalance < item.pointsCost) {
      toast.error('Insufficient points balance.');
      return;
    }

    setClaimingId(item.id);
    const idempotencyKey = createClaimIdempotencyKey();
    try {
      const result = await claimReward.mutateAsync({
        idempotencyKey,
        rewardType: item.type,
        rewardId: item.id,
        rewardName: item.name,
        pointsCost: item.pointsCost,
        currencyValue: item.currencyValue ?? 0,
        currencyCode: item.currencyCode,
      });

      if (result.status === 'SUCCESS') {
        toast.success(`Claim successful! Check your email for redemption details.`);
      } else if (result.status === 'PENDING') {
        toast.info('Claim pending fulfillment.');
      } else {
        toast.error(result.providerRef?.error ?? 'Claim failed. Points refunded.');
      }
    } catch (err) {
      toast.error(mapMemberWalletError(err, 'Failed to claim reward'));
    } finally {
      setClaimingId(null);
    }
  };

  const handleAirtimeClaim = async () => {
    if (!airtimePhone.trim()) {
      toast.error('Enter recipient phone number.');
      return;
    }
    const amount = Number(airtimeAmount);
    if (Number.isNaN(amount) || amount < 100) {
      toast.error('Minimum amount is 100');
      return;
    }

    if (!calculatedPoints) {
      toast.error('Please calculate point cost first.');
      return;
    }

    if (pointsBalance && pointsBalance.currentBalance < calculatedPoints) {
      toast.error(`Insufficient points. Needed: ${calculatedPoints} ${PAQ_POINTS_NAME}`);
      return;
    }

    setClaimingId('airtime');
    const idempotencyKey = createClaimIdempotencyKey();
    try {
      const selectedBundle = topupMode === 'data' ? selectedDataPlan : null;

      const rewardName = selectedBundle
        ? `${airtimeNetwork} ${selectedBundle.plan} Data Bundle`
        : `${airtimeNetwork} Airtime Top-up`;

      const result = await claimReward.mutateAsync({
        idempotencyKey,
        rewardType: 'NOMBA_AIRTIME',
        rewardId: 'NOMBA_AIRTIME',
        rewardName,
        pointsCost: calculatedPoints,
        currencyValue: amount,
        currencyCode: calculatedCurrency,
        recipientPhone: airtimePhone.trim(),
        airtimeNetwork,
        topupKind: topupMode,
      });

      if (result.status === 'SUCCESS') {
        toast.success(
          selectedBundle ? 'Data bundle sent successfully!' : 'Airtime sent successfully!',
        );
        setAirtimePhone('');
      } else if (result.status === 'FAILED') {
        toast.error(result.providerRef?.error ?? 'Purchase failed. Points refunded.');
      }
    } catch (err) {
      toast.error(mapMemberWalletError(err, 'Failed to top-up'));
    } finally {
      setClaimingId(null);
    }
  };

  const handleCreatePerk = async () => {
    if (!newTitle.trim()) {
      toast.error('Reward title is required');
      return;
    }
    try {
      await createCustomReward.mutateAsync({
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        pointsCost: Number(newPointsCost) || 100,
        deliveryInstructions: newInstructions.trim() || undefined,
      });
      setNewTitle('');
      setNewDesc('');
      setNewInstructions('');
      setIsAddingPerk(false);
      toast.success('Custom reward perk created successfully!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create perk');
    }
  };

  const handleDeletePerk = async (id: string) => {
    try {
      await deleteCustomReward.mutateAsync(id);
      toast.success('Custom reward perk deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete perk');
    }
  };

  const handleAddDefaultPerk = async (item: CatalogItem) => {
    setIsAddingTemplateId(item.id);
    try {
      await createCustomReward.mutateAsync({
        title: item.name,
        description: item.description ?? undefined,
        pointsCost: item.pointsCost,
        imageUrl: item.imageUrl ?? undefined,
        deliveryInstructions: item.deliveryInstructions ?? undefined,
      });
      toast.success(`"${item.name}" template added to your custom catalog!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add template perk');
    } finally {
      setIsAddingTemplateId(null);
    }
  };

  if (pointsLoading || catalogLoading || _Loading) {
    return isTab ? (
      <LoadingBlock />
    ) : (
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  const content = (
    <>
      {!isTab ? (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rewards</h1>
        </div>
      ) : null}

      <PointsSummaryCard
        balance={pointsBalance?.currentBalance ?? 0}
        totalEarned={pointsBalance?.totalEarned ?? 0}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-auto w-full justify-start flex-wrap gap-1.5 p-1.5 bg-muted/60">
          {showAirtime && (
            <TabsTrigger
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 h-auto"
              value="airtime"
            >
              <Phone className="mr-1.5 size-3.5" />
              Mobile Top-up
            </TabsTrigger>
          )}
          {showUtilities && (
            <TabsTrigger
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 h-auto"
              value="utilities"
            >
              <Zap className="mr-1.5 size-3.5" />
              Utility Bills
            </TabsTrigger>
          )}
          <TabsTrigger
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 h-auto"
            value="perks"
          >
            <Sparkles className="mr-1.5 size-3.5" />
            Custom Perks
          </TabsTrigger>
          {isGiftCardsEnabled && (
            <TabsTrigger
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 h-auto"
              value="digital-cards"
            >
              <ShoppingBag className="mr-1.5 size-3.5" />
              Digital Cards
            </TabsTrigger>
          )}
          <TabsTrigger
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 h-auto"
            value="history"
          >
            <Wallet className="mr-1.5 size-3.5" />
            My Claims
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 h-auto"
              value="all-claims"
            >
              <Trophy className="mr-1.5 size-3.5" />
              Employee Claims
            </TabsTrigger>
          )}
        </TabsList>

        {isGiftCardsEnabled && (
          <TabsContent value="digital-cards" className="space-y-4">
            {allowedCatalogCountries.length > 1 ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-semibold text-muted-foreground">Catalog country</p>
                <Select value={catalogCountryCode} onValueChange={setCatalogCountryCode}>
                  <SelectTrigger className="h-9 w-[220px] text-xs font-medium">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedCatalogCountries.map((code) => (
                      <SelectItem key={code} value={code} className="text-xs">
                        {catalogCountryLabel(code)} ({code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {giftCards.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No digital vouchers available for {catalogCountryCode} yet.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pb-2 border-b border-border/40">
              {(['All', 'Airtime', 'Money Cards', 'Gift Cards', 'Gaming Cards'] as const).map(
                (cat) => {
                  // Filter out categories based on admin preferences
                  if (
                    settings?.giftCardCategories &&
                    cat !== 'All' &&
                    !settings.giftCardCategories.includes(cat)
                  ) {
                    return null;
                  }

                  const count = giftCardsForCounts.filter((item) => {
                    if (cat === 'All') return true;
                    return getGiftCardCategory(item) === cat;
                  }).length;

                  if (count === 0 && cat !== 'All') return null;

                  return (
                    <Button
                      key={cat}
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        'h-8 text-xs font-semibold rounded-full px-4 border-border/60 transition-all',
                        selectedCategory === cat
                          ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
                          : 'hover:bg-muted text-muted-foreground',
                      )}
                    >
                      {cat}
                      <span
                        className={cn(
                          'ml-1.5 px-1.5 py-0.2 text-[10px] rounded-full font-bold',
                          selectedCategory === cat
                            ? 'bg-primary-foreground/20 text-primary-foreground'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {count}
                      </span>
                    </Button>
                  );
                },
              )}
            </div>

            {filteredGiftCards.length === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                title="No items in this category"
                description="Try switching to another category tab."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredGiftCards.map((item) => (
                  <CatalogCard
                    key={item.id}
                    item={item}
                    onClaim={handleClaim}
                    isClaiming={claimingId === item.id}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        )}

        {showAirtime && (
          <TabsContent value="airtime" className="space-y-6">
            <div className="w-full space-y-6 rounded-xl border border-border/60 bg-card p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                    <Phone className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Mobile Top-up</h3>
                    <p className="text-xs text-muted-foreground">
                      Send airtime or data bundles instantly
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  {selectedCountryCode === 'NG' && (
                    <div className="flex rounded-lg bg-muted p-1 border border-border/40 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setTopupMode('airtime');
                          setAirtimeAmount('1000');
                        }}
                        className={cn(
                          'cursor-pointer px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                          topupMode === 'airtime'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        Airtime
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTopupMode('data');
                        }}
                        className={cn(
                          'cursor-pointer px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                          topupMode === 'data'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        Data Bundle
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 space-y-6">
                  {selectedCountryCode === 'NG' ? (
                    <div className="space-y-3">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Select Network Provider
                      </Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {(
                          [
                            { key: 'MTN', color: 'hover:border-[#FFCC00]/50' },
                            { key: 'AIRTEL', color: 'hover:border-[#E11900]/50' },
                            { key: 'GLO', color: 'hover:border-[#00824A]/50' },
                            { key: '9MOBILE', color: 'hover:border-[#004F34]/50' },
                          ] as const
                        ).map(({ key, color }) => {
                          const isSelected = airtimeNetwork === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setAirtimeNetwork(key);
                              }}
                              className={cn(
                                'relative p-4 rounded-xl border-2 transition-all text-center flex flex-col items-center justify-center gap-2 bg-card cursor-pointer',
                                isSelected
                                  ? 'border-primary ring-2 ring-primary/20 shadow-md scale-[1.02]'
                                  : 'border-border/60 shadow-sm hover:scale-[1.01]',
                                color,
                              )}
                            >
                              {key === 'MTN' && (
                                <div className="flex h-9 w-20 items-center justify-center rounded-lg bg-[#FFCC00] text-[11px] font-black text-black select-none tracking-tighter">
                                  <span className="border border-black rounded-full px-2 py-0.5 text-[9px] font-extrabold bg-[#FFCC00]">
                                    MTN
                                  </span>
                                </div>
                              )}
                              {key === 'AIRTEL' && (
                                <div className="flex h-9 w-20 items-center justify-center rounded-lg bg-[#E11900] text-[13px] font-bold text-white select-none lowercase italic font-sans tracking-tighter">
                                  airtel
                                </div>
                              )}
                              {key === 'GLO' && (
                                <div className="flex h-9 w-20 items-center justify-center rounded-lg bg-[#00824A] text-[14px] font-extrabold text-white select-none lowercase tracking-tighter italic">
                                  glo
                                </div>
                              )}
                              {key === '9MOBILE' && (
                                <div className="flex h-9 w-20 items-center justify-center rounded-lg bg-[#004F34] text-[10px] font-bold text-[#A4C639] select-none tracking-tight">
                                  9<span className="text-white">mobile</span>
                                </div>
                              )}
                              <span className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                                {key === '9MOBILE' ? '9mobile' : key}
                              </span>
                              {isSelected && (
                                <div className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground rounded-full p-0.5">
                                  <Check className="size-3 stroke-[3]" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Select Global Operator
                      </Label>
                      <div className="text-xs text-muted-foreground italic">
                        Global airtime is not available. Only Nigerian airtime is supported.
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                        Recipient Phone Number
                      </Label>
                      <Input
                        placeholder={
                          selectedCountryCode === 'NG'
                            ? 'e.g. 08012345678'
                            : 'Include country code, e.g. +1...'
                        }
                        value={airtimePhone}
                        onChange={(e) => setAirtimePhone(e.target.value)}
                        className="h-10 text-sm font-medium"
                      />
                    </div>

                    {selectedCountryCode === 'NG' ? (
                      topupMode === 'airtime' && (
                        <div className="space-y-1.5">
                          <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                            Amount (₦)
                          </Label>
                          <Input
                            type="number"
                            min={100}
                            value={airtimeAmount}
                            onChange={(e) => setAirtimeAmount(e.target.value)}
                            className="h-10 text-sm font-medium"
                          />
                        </div>
                      )
                    ) : (
                      <div className="space-y-1.5">
                        <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                          Amount
                        </Label>
                        <Input
                          type="number"
                          min={100}
                          value={airtimeAmount}
                          onChange={(e) => setAirtimeAmount(e.target.value)}
                          className="h-10 text-sm font-medium"
                        />
                      </div>
                    )}
                  </div>

                  {selectedCountryCode === 'NG' && topupMode === 'airtime' && (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Quick Select Amount
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {['200', '500', '1000', '2000', '5000'].map((amt) => (
                          <Button
                            key={amt}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAirtimeAmount(amt)}
                            className={cn(
                              'h-9 px-4 text-xs font-semibold rounded-lg',
                              airtimeAmount === amt && 'border-primary bg-primary/5 text-primary',
                            )}
                          >
                            ₦{Number(amt).toLocaleString()}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl bg-muted/30 border border-border/40 p-5 space-y-6">
                  <div className="space-y-5">
                    {selectedCountryCode === 'NG' && topupMode === 'data' && (
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Select Data Plan
                        </Label>
                        {dataPlansLoading ? (
                          <p className="text-xs text-muted-foreground">Loading data plans…</p>
                        ) : nombaDataPlans.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No data plans available for this network.
                          </p>
                        ) : (
                          <Select
                            value={selectedBundleId}
                            onValueChange={(val) => {
                              setSelectedBundleId(val);
                              const plan = nombaDataPlans.find((item) => dataPlanId(item) === val);
                              if (plan) setAirtimeAmount(String(plan.amount));
                            }}
                          >
                            <SelectTrigger className="h-10 text-xs font-medium">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {nombaDataPlans.map((plan) => (
                                <SelectItem key={dataPlanId(plan)} value={dataPlanId(plan)}>
                                  {plan.plan} — ₦{plan.amount.toLocaleString()}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}

                    {Number(airtimeAmount) > 0 && (
                      <div className="rounded-xl border border-border/40 bg-card p-4 space-y-3 text-sm shadow-inner">
                        <div className="flex justify-between text-xs text-muted-foreground font-medium">
                          <span>Recharge Value</span>
                          <span className="font-bold text-foreground">
                            {selectedCountryCode === 'NG' ? '₦' : '$ '}
                            {Number(airtimeAmount).toLocaleString()}
                          </span>
                        </div>

                        {selectedCountryCode === 'NG' ? (
                          <div className="flex justify-between text-xs text-muted-foreground font-medium">
                            <span>Processing Fee</span>
                            <span className="font-bold text-foreground">
                              {pointsCalcError
                                ? '—'
                                : `+₦${(airtimeProcessingFee ?? 0).toLocaleString()}`}
                            </span>
                          </div>
                        ) : (
                          <div className="flex justify-between text-xs text-muted-foreground font-medium">
                            <span>Global Processing</span>
                            <span className="font-bold text-foreground">Inclusive of FX Rates</span>
                          </div>
                        )}

                        <div className="h-px bg-border/50 my-2" />
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-foreground">Total Cost in Points</span>
                          {isCalculatingPoints ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Loader2 className="size-3 animate-spin" /> Calculating...
                            </span>
                          ) : pointsCalcError ? (
                            <span className="text-xs text-destructive italic">
                              {pointsCalcError}
                            </span>
                          ) : calculatedPoints ? (
                            <span className="text-lg font-black text-primary flex items-center gap-1">
                              <Trophy className="size-4.5 text-amber-500 fill-amber-500" />
                              {calculatedPoints.toLocaleString()} pts
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Enter valid amount
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <Button
                    className="w-full h-11 font-bold text-sm tracking-wide shadow-md mt-auto bg-indigo-600 hover:bg-indigo-700 text-white"
                    disabled={claimingId === 'airtime' || !airtimePhone || !calculatedPoints}
                    onClick={handleAirtimeClaim}
                  >
                    {claimingId === 'airtime' ? (
                      <>
                        <Loader2 className="mr-1.5 size-4 animate-spin" />
                        Processing...
                      </>
                    ) : selectedCountryCode === 'NG' && topupMode === 'data' ? (
                      'Send Data Bundle'
                    ) : (
                      'Send Airtime'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        )}

        {showUtilities && (
          <TabsContent value="utilities" className="space-y-6">
            <div className="w-full space-y-6 rounded-xl border border-border/60 bg-card p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600">
                    <Zap className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Utility Bills</h3>
                    <p className="text-xs text-muted-foreground">
                      Pay electricity, water, and internet bills instantly using points
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 space-y-6">
                  {utilityCountryCode === 'NG' ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Select Biller
                        </Label>
                        {ngBillersLoading ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="size-4 animate-spin text-primary" /> Loading
                            Billers...
                          </div>
                        ) : ngUtilityBillers.length === 0 ? (
                          <div className="text-xs text-muted-foreground italic">
                            No electricity billers available.
                          </div>
                        ) : (
                          <Select
                            value={selectedUtilityBillerNg}
                            onValueChange={(value) => {
                              setSelectedUtilityBillerNg(value);
                              setLookupResult(null);
                            }}
                          >
                            <SelectTrigger className="h-10 text-xs">
                              <SelectValue placeholder="Select electricity biller..." />
                            </SelectTrigger>
                            <SelectContent>
                              {ngUtilityBillers.map((u) => (
                                <SelectItem
                                  key={String(u.id)}
                                  value={String(u.id)}
                                  className="text-xs"
                                >
                                  {u.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Service Type
                        </Label>
                        <Select
                          value={utilityServiceType}
                          onValueChange={(val) => {
                            setUtilityServiceType(val as 'PREPAID' | 'POSTPAID');
                            setLookupResult(null);
                          }}
                        >
                          <SelectTrigger className="h-10 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PREPAID" className="text-xs">
                              Prepaid Meter
                            </SelectItem>
                            <SelectItem value="POSTPAID" className="text-xs">
                              Postpaid Account
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Select Global Utility Biller
                      </Label>
                      <div className="text-xs text-muted-foreground italic">
                        Global utility payments are not available. Only Nigerian utilities are
                        supported.
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                        Meter / Subscriber Account Number
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g. 0419283746"
                          value={utilityAccountNumber}
                          onChange={(e) => {
                            setUtilityAccountNumber(e.target.value);
                            setLookupResult(null);
                          }}
                          className="h-10 text-sm font-medium"
                        />
                        {utilityCountryCode === 'NG' && (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleLookupMeter}
                            disabled={
                              isLookingUpMeter ||
                              !utilityAccountNumber.trim() ||
                              !selectedUtilityBillerNg
                            }
                            className="h-10 text-xs font-semibold shrink-0"
                          >
                            {isLookingUpMeter ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              'Verify'
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                        Amount to Pay
                      </Label>
                      <Input
                        type="number"
                        min={100}
                        value={utilityAmount}
                        onChange={(e) => setUtilityAmount(e.target.value)}
                        className="h-10 text-sm font-medium"
                      />
                    </div>
                  </div>

                  {lookupResult && (
                    <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50/20 dark:bg-green-950/10 p-4 space-y-1.5 text-xs text-foreground">
                      <p className="font-bold text-green-700 dark:text-green-400">
                        ✓ Account Verified
                      </p>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Customer Name</p>
                          <p className="font-semibold">{lookupResult.customerName || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Meter Number</p>
                          <p className="font-mono font-semibold">{lookupResult.meterNumber}</p>
                        </div>
                        {lookupResult.address && (
                          <div className="col-span-2">
                            <p className="text-[10px] text-muted-foreground">Address</p>
                            <p className="font-semibold">{lookupResult.address}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl bg-muted/30 border border-border/40 p-5 space-y-6">
                  <div className="space-y-5">
                    {Number(utilityAmount) > 0 && (
                      <div className="rounded-xl border border-border/40 bg-card p-4 space-y-3 text-sm shadow-inner">
                        <div className="flex justify-between text-xs text-muted-foreground font-medium">
                          <span>Payment Value</span>
                          <span className="font-bold text-foreground">
                            {utilityCountryCode === 'NG' ? '₦' : '$ '}
                            {Number(utilityAmount).toLocaleString()}
                          </span>
                        </div>

                        {utilityCountryCode === 'NG' ? (
                          <div className="flex justify-between text-xs text-muted-foreground font-medium">
                            <span>Processing Fee</span>
                            <span className="font-bold text-foreground">
                              {utilityCalcError
                                ? '—'
                                : `+₦${(utilityProcessingFee ?? 0).toLocaleString()}`}
                            </span>
                          </div>
                        ) : (
                          <div className="flex justify-between text-xs text-muted-foreground font-medium">
                            <span>Processing Fee</span>
                            <span className="font-bold text-foreground">Inclusive of FX Rates</span>
                          </div>
                        )}

                        <div className="h-px bg-border/50 my-2" />
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-foreground">Total Cost in Points</span>
                          {isCalculatingUtilityPoints ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Loader2 className="size-3 animate-spin" /> Calculating...
                            </span>
                          ) : utilityCalcError ? (
                            <span className="text-xs text-destructive italic">
                              {utilityCalcError}
                            </span>
                          ) : utilityPoints ? (
                            <span className="text-lg font-black text-primary flex items-center gap-1">
                              <Trophy className="size-4.5 text-amber-500 fill-amber-500" />
                              {utilityPoints.toLocaleString()} pts
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Enter valid amount
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <Button
                    className="w-full h-11 font-bold text-sm tracking-wide shadow-md mt-auto bg-indigo-600 hover:bg-indigo-700 text-white"
                    disabled={
                      claimingId === 'utility' ||
                      !utilityAccountNumber ||
                      !utilityPoints ||
                      (utilityCountryCode === 'NG' && (!lookupResult || !selectedUtilityBillerNg))
                    }
                    onClick={handleUtilityClaim}
                  >
                    {claimingId === 'utility' ? (
                      <>
                        <Loader2 className="mr-1.5 size-4 animate-spin" />
                        Processing Payment...
                      </>
                    ) : (
                      'Pay Utility Bill'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        )}

        <TabsContent value="perks" className="space-y-4">
          {isAdmin && !isAddingPerk && (
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => setIsAddingPerk(true)}
                className="gap-1 text-xs font-semibold"
              >
                <Plus className="size-3.5" />
                Add Custom Perk
              </Button>
            </div>
          )}

          {isAdmin && isAddingPerk && (
            <Card className="max-w-lg border-dashed border-border/85 bg-muted/10">
              <CardContent className="p-5 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Create Custom Perk
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Reward Title</Label>
                    <Input
                      placeholder="e.g. Lunch with CEO"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Points Cost</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 500"
                      value={newPointsCost}
                      onChange={(e) => setNewPointsCost(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Textarea
                      placeholder="e.g. Enjoy a private lunch with our executive leadership team."
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      rows={2}
                      className="text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs">Fulfillment Instructions</Label>
                    <Input
                      placeholder="e.g. We will contact you to schedule the date within 3 business days."
                      value={newInstructions}
                      onChange={(e) => setNewInstructions(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs font-semibold"
                    onClick={() => setIsAddingPerk(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs font-semibold"
                    onClick={handleCreatePerk}
                    disabled={createCustomReward.isPending || !newTitle.trim()}
                  >
                    {createCustomReward.isPending ? (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : null}
                    Create Perk
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {customPerks.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-4 text-xs text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/60 dark:text-amber-300">
                <span className="font-bold">No custom perks set up yet.</span> Below are default
                templates.{' '}
                {isAdmin
                  ? 'As an admin, you can add them to your active catalog.'
                  : 'Once added by your admin, they will be redeemable.'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {availablePerkTemplates.map((item) => (
                  <CatalogCard
                    key={item.id}
                    item={item}
                    onClaim={handleClaim}
                    isClaiming={claimingId === item.id}
                    isAdmin={isAdmin}
                    onAddDefault={handleAddDefaultPerk}
                    isAddingDefault={isAddingTemplateId === item.id}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {customPerks.map((item) => (
                  <CatalogCard
                    key={item.id}
                    item={item}
                    onClaim={handleClaim}
                    isClaiming={claimingId === item.id}
                    isAdmin={isAdmin}
                    onDelete={handleDeletePerk}
                    isDeleting={deleteCustomReward.isPending}
                  />
                ))}
              </div>

              {isAdmin && availablePerkTemplates.length > 0 && (
                <div className="space-y-4 border-t pt-8">
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                      <Sparkles className="size-4 text-amber-500 fill-amber-500/20" />
                      Perk Templates
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Add pre-configured perks to your active catalog with one click
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availablePerkTemplates.map((item) => (
                      <CatalogCard
                        key={item.id}
                        item={item}
                        onClaim={handleClaim}
                        isClaiming={claimingId === item.id}
                        isAdmin={isAdmin}
                        onAddDefault={handleAddDefaultPerk}
                        isAddingDefault={isAddingTemplateId === item.id}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {claimsLoading ? (
            <LoadingBlock />
          ) : claims.length === 0 ? (
            <EmptyState
              icon={Gift}
              title="No claims yet"
              description="Redeem your points for rewards and they'll show up here."
            />
          ) : (
            <div className="space-y-2">
              {claims.map((claim) => (
                <ClaimRow key={claim.id} claim={claim} />
              ))}
            </div>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="all-claims" className="space-y-4">
            {allClaimsLoading ? (
              <LoadingBlock />
            ) : allClaims.length === 0 ? (
              <EmptyState
                icon={Gift}
                title="No claims registered"
                description="Employee claims will show up here once they start redeeming rewards."
              />
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b pb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Employee Redemptions Log
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Monitor and review all points redemptions across your organization.
                    </p>
                  </div>
                  <div className="relative w-full sm:w-[320px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by employee, reward, phone or email..."
                      value={claimsSearch}
                      onChange={(e) => setClaimsSearch(e.target.value)}
                      className="pl-9 h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredAllClaims.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground italic">
                      No claims found matching your search.
                    </div>
                  ) : (
                    filteredAllClaims.map((claim: RewardRedemption) => {
                      const memberName = claim.member
                        ? `${claim.member.firstName} ${claim.member.lastName}`
                        : `Member #${claim.memberId.slice(0, 8)}`;

                      const statusColors: Record<string, string> = {
                        SUCCESS:
                          'bg-green-500/10 text-green-600 border-green-200 dark:border-green-800',
                        PENDING:
                          'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800',
                        PROCESSING:
                          'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800',
                        FAILED: 'bg-red-500/10 text-red-600 border-red-200 dark:border-red-800',
                      };

                      return (
                        <div
                          key={claim.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border/60 bg-card p-4 hover:border-primary/20 transition-all shadow-sm"
                        >
                          <div className="flex items-start gap-3.5 min-w-0">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 shrink-0">
                              {claim.rewardType === 'NOMBA_AIRTIME' ? (
                                <Phone className="size-5" />
                              ) : claim.rewardType === 'CUSTOM' ? (
                                <Sparkles className="size-5 text-amber-500" />
                              ) : claim.rewardType === 'NOMBA_UTILITY' ? (
                                <Zap className="size-5 text-indigo-600" />
                              ) : (
                                <ShoppingBag className="size-5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-foreground">
                                {claim.rewardName ?? claim.rewardId}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-foreground bg-muted/60 px-1.5 py-0.5 rounded text-[10px]">
                                  {memberName}
                                </span>
                                <span>·</span>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                  {claim.pointsSpent} pts
                                </span>
                                <span>·</span>
                                <span>{new Date(claim.createdAt).toLocaleDateString()}</span>
                              </p>

                              {(claim.recipient?.phone || claim.recipient?.email) && (
                                <p className="text-[11px] text-muted-foreground mt-1 bg-muted/40 px-2 py-0.5 rounded-md inline-block">
                                  {claim.recipient?.phone
                                    ? `📞 ${claim.recipient.phone}`
                                    : `✉️ ${claim.recipient?.email}`}
                                </p>
                              )}

                              {claim.status === 'FAILED' && claim.providerRef?.error && (
                                <p className="mt-1 text-[11px] text-red-500 font-semibold leading-tight">
                                  Error: {claim.providerRef.error}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] py-1 px-2.5 font-bold flex items-center gap-1.5',
                                statusColors[claim.status],
                              )}
                            >
                              {claim.status === 'PENDING' || claim.status === 'PROCESSING' ? (
                                <Loader2 className="size-2.5 animate-spin" />
                              ) : null}
                              {claim.status}
                            </Badge>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </>
  );

  if (isTab) {
    return <div className="space-y-6">{content}</div>;
  }

  return <AppPage className="w-full space-y-6">{content}</AppPage>;
}
