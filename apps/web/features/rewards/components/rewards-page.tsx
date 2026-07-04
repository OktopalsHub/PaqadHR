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
  Trash2,
  Trophy,
  Wallet,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
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
  useRewardsCatalog,
  useTopupOperators,
  useUtilityBillers,
} from '@/hooks/queries/use-rewards';
import { useMyPointsBalance } from '@/hooks/queries/use-shoutouts';
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

function PointsSummaryCard({ balance, totalEarned }: { balance: number; totalEarned: number }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/5 via-background to-primary/10 p-6 shadow-lg">
      <div className="absolute -right-6 -top-6 size-24 rounded-full bg-primary/5 blur-2xl" />
      <div className="relative flex items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
          <Trophy className="size-7" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{PAQ_POINTS_NAME} Balance</p>
          <p className="text-3xl font-bold tabular-nums text-foreground">
            {balance.toLocaleString()}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">Lifetime earned</p>
          <p className="text-lg font-semibold tabular-nums text-primary">
            {totalEarned.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

function getReloadlyCategory(
  item: CatalogItem,
): 'Airtime' | 'Money Cards' | 'Gift Cards' | 'Gaming Cards' {
  const name = item.name.toLowerCase();

  if (
    name.includes('airtime') ||
    name.includes('mobile topup') ||
    name.includes('refill') ||
    name.includes('top-up') ||
    name.includes('telecom') ||
    name.includes('mtn') ||
    name.includes('airtel') ||
    name.includes('orange') ||
    name.includes('vodafone') ||
    name.includes('safaricom') ||
    name.includes('tigo')
  ) {
    return 'Airtime';
  }

  if (
    name.includes('visa') ||
    name.includes('mastercard') ||
    name.includes('american express') ||
    name.includes('amex') ||
    name.includes('prepaid card') ||
    name.includes('cash') ||
    name.includes('money')
  ) {
    return 'Money Cards';
  }

  if (
    name.includes('playstation') ||
    name.includes('xbox') ||
    name.includes('steam') ||
    name.includes('nintendo') ||
    name.includes('roblox') ||
    name.includes('pubg') ||
    name.includes('razer') ||
    name.includes('gaming') ||
    name.includes('riot') ||
    name.includes('league of legends') ||
    name.includes('minecraft') ||
    name.includes('nexon') ||
    name.includes('twitch')
  ) {
    return 'Gaming Cards';
  }

  return 'Gift Cards';
}

const DEFAULT_CUSTOM_PERKS: CatalogItem[] = [
  {
    id: 'default_swag',
    name: 'Hoodie & Swag Kit',
    description:
      'Get a premium company branded hoodie, water bottle, and sticker pack shipped to you.',
    pointsCost: 3000,
    type: 'CUSTOM',
    currencyValue: 3000,
    currencyCode: 'NGN',
    imageUrl:
      'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500&auto=format&fit=crop&q=60',
    deliveryInstructions: 'Your HR team will reach out to request your size and shipping address.',
  },
  {
    id: 'default_day_off',
    name: 'Extra Day of Paid Time Off (PTO)',
    description: 'Enjoy an additional day of paid leave. Must be scheduled with your manager.',
    pointsCost: 5000,
    type: 'CUSTOM',
    currencyValue: 5000,
    currencyCode: 'NGN',
    imageUrl:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=60',
    deliveryInstructions: 'Leave credit will be applied directly to your profile upon approval.',
  },
  {
    id: 'default_coffee',
    name: 'Starbucks Coffee & Muffin Voucher',
    description: 'Start your morning right with a warm beverage and snack on us.',
    pointsCost: 500,
    type: 'CUSTOM',
    currencyValue: 500,
    currencyCode: 'NGN',
    imageUrl:
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&auto=format&fit=crop&q=60',
    deliveryInstructions: 'A digital voucher code will be sent to your registered work email.',
  },
  {
    id: 'default_gym',
    name: '1-Month Gym Membership Subsidy',
    description: 'Stay healthy and active! Get your local gym membership funded for a month.',
    pointsCost: 4000,
    type: 'CUSTOM',
    currencyValue: 4000,
    currencyCode: 'NGN',
    imageUrl:
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500&auto=format&fit=crop&q=60',
    deliveryInstructions:
      'Submit your gym receipt to HR to receive a full cash-back reimbursement.',
  },
];

function CatalogCard({
  item,
  onClaim,
  isClaiming,
  isAdmin = false,
  onDelete,
  isDeleting = false,
  onAddDefault,
  isAddingDefault = false,
}: {
  item: CatalogItem;
  onClaim: (item: CatalogItem) => void;
  isClaiming: boolean;
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
  onAddDefault?: (item: CatalogItem) => void;
  isAddingDefault?: boolean;
}) {
  const isTemplate = item.id.startsWith('default_');
  const typeColors: Record<string, string> = {
    RELOADLY: 'bg-violet-500/10 text-violet-600 border-violet-200 dark:border-violet-800',
    NOMBA_AIRTIME: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800',
    RELOADLY_AIRTIME:
      'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800',
    NOMBA_UTILITY: 'bg-indigo-500/10 text-indigo-600 border-indigo-200 dark:border-indigo-800',
    RELOADLY_UTILITY: 'bg-indigo-500/10 text-indigo-600 border-indigo-200 dark:border-indigo-800',
    CUSTOM: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800',
  };

  const typeLabels: Record<string, string> = {
    RELOADLY: 'Digital Voucher',
    NOMBA_AIRTIME: 'Airtime',
    RELOADLY_AIRTIME: 'Airtime',
    NOMBA_UTILITY: 'Utility',
    RELOADLY_UTILITY: 'Utility',
    CUSTOM: isTemplate ? 'Template Perk' : 'Custom Perk',
  };

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/30">
      {item.imageUrl ? (
        <div className="aspect-[16/10] w-full overflow-hidden bg-muted/30 relative">
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-contain p-4 transition-transform group-hover:scale-105"
          />
          {isTemplate && (
            <Badge className="absolute top-2 left-2 bg-amber-500 hover:bg-amber-600 text-white border-none text-[9px] uppercase tracking-wider font-bold">
              Template
            </Badge>
          )}
        </div>
      ) : (
        <div className="flex aspect-[16/10] w-full items-center justify-center bg-gradient-to-br from-primary/5 to-primary/15 relative">
          <Gift className="size-10 text-primary/40" />
          {isTemplate && (
            <Badge className="absolute top-2 left-2 bg-amber-500 hover:bg-amber-600 text-white border-none text-[9px] uppercase tracking-wider font-bold">
              Template
            </Badge>
          )}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight text-foreground line-clamp-2">
            {item.name}
          </h3>
          <Badge variant="outline" className={cn('shrink-0 text-[10px]', typeColors[item.type])}>
            {typeLabels[item.type]}
          </Badge>
        </div>
        {item.description ? (
          <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
        ) : null}
        {item.countryCode ? (
          <p className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
            <span>🌐</span> {item.countryCode}
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between pt-2">
          <div>
            <p className="text-lg font-bold tabular-nums text-primary">
              {item.pointsCost.toLocaleString()}
            </p>
            <p className="text-[10px] text-muted-foreground">{PAQ_POINTS_NAME}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin && item.type === 'CUSTOM' && onDelete && !isTemplate && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-destructive hover:bg-destructive/10"
                disabled={isDeleting}
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}

            {isTemplate ? (
              isAdmin && onAddDefault ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1 border-amber-300 bg-amber-500/5 text-amber-700 hover:bg-amber-50 hover:text-white"
                  disabled={isAddingDefault}
                  onClick={() => onAddDefault(item)}
                >
                  {isAddingDefault ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Plus className="size-3" />
                  )}
                  Add to Catalog
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="h-8 text-xs" disabled>
                  HR Template
                </Button>
              )
            ) : (
              <Button
                size="sm"
                className="h-8 text-xs font-bold"
                disabled={isClaiming}
                onClick={() => onClaim(item)}
              >
                {isClaiming ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                Redeem
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ClaimRow({ claim }: { claim: RewardRedemption }) {
  const statusColors: Record<string, string> = {
    SUCCESS: 'bg-green-500/10 text-green-600 border-green-200 dark:border-green-800',
    PENDING: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800',
    FAILED: 'bg-red-500/10 text-red-600 border-red-200 dark:border-red-800',
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3 bg-card shadow-sm">
      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {claim.rewardType === 'NOMBA_AIRTIME' || claim.rewardType === 'RELOADLY_AIRTIME' ? (
          <Phone className="size-4" />
        ) : claim.rewardType === 'NOMBA_UTILITY' || claim.rewardType === 'RELOADLY_UTILITY' ? (
          <Zap className="size-4 text-indigo-600" />
        ) : claim.rewardType === 'CUSTOM' ? (
          <Sparkles className="size-4" />
        ) : (
          <ShoppingBag className="size-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{claim.rewardName ?? claim.rewardId}</p>
        <p className="text-[11px] text-muted-foreground">
          {claim.pointsSpent} {PAQ_POINTS_NAME} · {new Date(claim.createdAt).toLocaleDateString()}
        </p>
        {claim.voucherCode ? (
          <p className="mt-1 font-mono text-xs font-semibold text-foreground bg-muted px-2 py-0.5 rounded inline-block">
            Code: {claim.voucherCode}
            {claim.voucherPin ? ` · PIN: ${claim.voucherPin}` : ''}
          </p>
        ) : null}
        {claim.voucherInstructions ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground italic">
            {claim.voucherInstructions}
          </p>
        ) : null}
        {claim.status === 'FAILED' && claim.errorMessage && (
          <p className="mt-1 text-[11px] text-red-500 font-semibold leading-tight">
            Error: {claim.errorMessage}
          </p>
        )}
      </div>
      <Badge
        variant="outline"
        className={cn(
          'shrink-0 text-[10px] font-bold flex items-center gap-1.5',
          statusColors[claim.status],
        )}
      >
        {claim.status === 'SUCCESS' ? <Check className="size-2.5" /> : null}
        {claim.status === 'PENDING' ? <Loader2 className="size-2.5 animate-spin" /> : null}
        {claim.status}
      </Badge>
    </div>
  );
}

interface DataBundle {
  id: string;
  name: string;
  price: number;
  validity: string;
}

const DATA_BUNDLES: Record<'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE', DataBundle[]> = {
  MTN: [
    { id: 'mtn_1.5gb', name: '1.5GB', price: 1000, validity: '30 Days' },
    { id: 'mtn_3gb', name: '3GB', price: 1600, validity: '30 Days' },
    { id: 'mtn_5gb', name: '5GB', price: 2500, validity: '30 Days' },
    { id: 'mtn_10gb', name: '10GB', price: 4000, validity: '30 Days' },
    { id: 'mtn_20gb', name: '20GB', price: 7500, validity: '30 Days' },
  ],
  AIRTEL: [
    { id: 'airtel_1.5gb', name: '1.5GB', price: 1000, validity: '30 Days' },
    { id: 'airtel_3gb', name: '3GB', price: 1600, validity: '30 Days' },
    { id: 'airtel_5gb', name: '5GB', price: 2500, validity: '30 Days' },
    { id: 'airtel_10gb', name: '10GB', price: 4000, validity: '30 Days' },
    { id: 'airtel_20gb', name: '20GB', price: 7500, validity: '30 Days' },
  ],
  GLO: [
    { id: 'glo_1.8gb', name: '1.8GB', price: 1000, validity: '30 Days' },
    { id: 'glo_3.9gb', name: '3.9GB', price: 1600, validity: '30 Days' },
    { id: 'glo_5.8gb', name: '5.8GB', price: 2500, validity: '30 Days' },
    { id: 'glo_12gb', name: '12GB', price: 4000, validity: '30 Days' },
    { id: 'glo_24gb', name: '24GB', price: 7500, validity: '30 Days' },
  ],
  '9MOBILE': [
    { id: '9mobile_1.5gb', name: '1.5GB', price: 1000, validity: '30 Days' },
    { id: '9mobile_3gb', name: '3GB', price: 1500, validity: '30 Days' },
    { id: '9mobile_5gb', name: '5GB', price: 2500, validity: '30 Days' },
    { id: '9mobile_11gb', name: '11GB', price: 4000, validity: '30 Days' },
    { id: '9mobile_22gb', name: '22GB', price: 7500, validity: '30 Days' },
  ],
};

const NG_UTILITIES = [
  { id: 'EKEDC', name: 'Eko Electricity (EKEDC)' },
  { id: 'IKEDC', name: 'Ikeja Electricity (IKEDC)' },
  { id: 'AEDC', name: 'Abuja Electricity (AEDC)' },
  { id: 'IBEDC', name: 'Ibadan Electricity (IBEDC)' },
  { id: 'PHEDC', name: 'Port Harcourt Electricity (PHEDC)' },
  { id: 'KEDCO', name: 'Kano Electricity (KEDCO)' },
  { id: 'JED', name: 'Jos Electricity (JED)' },
  { id: 'EEDC', name: 'Enugu Electricity (EEDC)' },
  { id: 'KAEDCO', name: 'Kaduna Electricity (KAEDCO)' },
  { id: 'BEDC', name: 'Benin Electricity (BEDC)' },
  { id: 'YEDC', name: 'Yola Electricity (YEDC)' },
];

export function RewardsPage({ isTab = false }: { isTab?: boolean } = {}) {
  const { tenant } = useTenant();
  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';
  const settings = tenant?.settings?.rewards;

  const isAirtimeEnabled = settings?.airtimeEnabled ?? true;
  const isGiftCardsEnabled = settings?.giftCardsEnabled ?? true;
  const isUtilitiesEnabled = settings?.utilityPaymentsEnabled ?? true;

  const catalogCountries = (settings?.catalogCountries ?? ['NG']) as string[];

  const { data: pointsBalance, isLoading: pointsLoading } = useMyPointsBalance();
  const { data: catalog = [], isLoading: catalogLoading } = useRewardsCatalog();
  const { data: claims = [], isLoading: claimsLoading } = useMyClaims();
  const { data: allClaims = [], isLoading: allClaimsLoading } = useAllClaims();
  const claimReward = useClaimReward();

  const createCustomReward = useCreateCustomReward();
  const deleteCustomReward = useDeleteCustomReward();

  // Top-up (Airtime/Data) States
  const [selectedCountryCode, setSelectedCountryCode] = useState(catalogCountries[0] || 'NG');
  const [airtimePhone, setAirtimePhone] = useState('');
  const [airtimeNetwork, setAirtimeNetwork] = useState<'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE'>('MTN');
  const [airtimeAmount, setAirtimeAmount] = useState('1000');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [topupMode, setTopupMode] = useState<'airtime' | 'data'>('airtime');
  const [selectedBundleId, setSelectedBundleId] = useState<string>('');

  // Reloadly Topup specific states
  const [selectedReloadlyOperatorId, setSelectedReloadlyOperatorId] = useState<string>('');
  const { data: reloadlyOperators = [], isLoading: operatorsLoading } = useTopupOperators(
    selectedCountryCode !== 'NG' ? selectedCountryCode : '',
  );

  const selectedReloadlyOperator = reloadlyOperators.find(
    (o) => String(o.operatorId) === selectedReloadlyOperatorId,
  );

  // Sync selected country code if settings change
  useEffect(() => {
    if (catalogCountries.length > 0 && !catalogCountries.includes(selectedCountryCode)) {
      setSelectedCountryCode(catalogCountries[0]);
    }
  }, [catalogCountries, selectedCountryCode]);

  // Sync operator default when operators load
  useEffect(() => {
    if (reloadlyOperators.length > 0) {
      setSelectedReloadlyOperatorId(String(reloadlyOperators[0].operatorId));
      if (reloadlyOperators[0].denominationType === 'FIXED') {
        setAirtimeAmount('');
      }
    }
  }, [reloadlyOperators]);

  // JIT Points calculation states for top-ups
  const [calculatedPoints, setCalculatedPoints] = useState<number | null>(null);
  const [_calculatedValue, setCalculatedValue] = useState<number | null>(null);
  const [calculatedCurrency, setCalculatedCurrency] = useState<string>('NGN');
  const [airtimeProcessingFee, setAirtimeProcessingFee] = useState<number | null>(null);
  const [isCalculatingPoints, setIsCalculatingPoints] = useState(false);

  useEffect(() => {
    const amt = Number(airtimeAmount) || 0;
    if (selectedCountryCode === 'NG') {
      if (amt >= 100) {
        const delayDebounceFn = setTimeout(async () => {
          setIsCalculatingPoints(true);
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
            console.error(e);
            setCalculatedPoints(null);
            setAirtimeProcessingFee(null);
          } finally {
            setIsCalculatingPoints(false);
          }
        }, 500);
        return () => clearTimeout(delayDebounceFn);
      }
      setCalculatedPoints(null);
      setAirtimeProcessingFee(null);
      return;
    }

    if (amt > 0 && selectedReloadlyOperator) {
      const delayDebounceFn = setTimeout(async () => {
        setIsCalculatingPoints(true);
        try {
          const res = await calculatePointsCost({
            type: 'airtime',
            billerId: selectedReloadlyOperator.operatorId,
            amount: amt,
          });
          setCalculatedPoints(res.pointsCost);
          setCalculatedValue(res.currencyValue);
          setCalculatedCurrency(res.currencyCode);
        } catch (e) {
          console.error(e);
          setCalculatedPoints(null);
        } finally {
          setIsCalculatingPoints(false);
        }
      }, 500);
      return () => clearTimeout(delayDebounceFn);
    }
    setCalculatedPoints(null);
  }, [airtimeAmount, selectedReloadlyOperator, selectedCountryCode]);

  // Utility Bill States
  const [utilityCountryCode, setUtilityCountryCode] = useState(catalogCountries[0] || 'NG');
  const [selectedUtilityBillerNg, setSelectedUtilityBillerNg] = useState('EKEDC');
  const [selectedUtilityBillerReloadlyId, setSelectedUtilityBillerReloadlyId] =
    useState<string>('');
  const [utilityAccountNumber, setUtilityAccountNumber] = useState('');
  const [utilityAmount, setUtilityAmount] = useState('1000');
  const [utilityServiceType, setUtilityServiceType] = useState<'PREPAID' | 'POSTPAID'>('PREPAID');

  const { data: reloadlyBillers = [], isLoading: billersLoading } = useUtilityBillers(
    utilityCountryCode !== 'NG' ? utilityCountryCode : '',
  );

  const selectedUtilityBillerReloadly = reloadlyBillers.find(
    (b) => String(b.id) === selectedUtilityBillerReloadlyId,
  );

  // Sync selected country code for utilities if settings change
  useEffect(() => {
    if (catalogCountries.length > 0 && !catalogCountries.includes(utilityCountryCode)) {
      setUtilityCountryCode(catalogCountries[0]);
    }
  }, [catalogCountries, utilityCountryCode]);

  // Sync utility biller default when billers load
  useEffect(() => {
    if (reloadlyBillers.length > 0) {
      setSelectedUtilityBillerReloadlyId(String(reloadlyBillers[0].id));
    }
  }, [reloadlyBillers]);

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

  useEffect(() => {
    const amt = Number(utilityAmount) || 0;
    if (utilityCountryCode === 'NG') {
      if (amt >= 100) {
        const delayDebounceFn = setTimeout(async () => {
          setIsCalculatingUtilityPoints(true);
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
            console.error(e);
            setUtilityPoints(null);
            setUtilityProcessingFee(null);
          } finally {
            setIsCalculatingUtilityPoints(false);
          }
        }, 500);
        return () => clearTimeout(delayDebounceFn);
      }
      setUtilityPoints(null);
      setUtilityProcessingFee(null);
      return;
    }

    if (amt > 0 && selectedUtilityBillerReloadly) {
      const delayDebounceFn = setTimeout(async () => {
        setIsCalculatingUtilityPoints(true);
        try {
          const res = await calculatePointsCost({
            type: 'utility',
            billerId: selectedUtilityBillerReloadly.id,
            amount: amt,
          });
          setUtilityPoints(res.pointsCost);
          setUtilityCalculatedValue(res.currencyValue);
          setUtilityCalculatedCurrency(res.currencyCode);
        } catch (e) {
          console.error(e);
          setUtilityPoints(null);
        } finally {
          setIsCalculatingUtilityPoints(false);
        }
      }, 500);
      return () => clearTimeout(delayDebounceFn);
    }
    setUtilityPoints(null);
  }, [utilityAmount, selectedUtilityBillerReloadly, utilityCountryCode]);

  const handleLookupMeter = async () => {
    if (!utilityAccountNumber.trim()) {
      toast.error('Please enter meter / account number');
      return;
    }
    setIsLookingUpMeter(true);
    setLookupResult(null);
    try {
      const billerId =
        utilityCountryCode === 'NG'
          ? selectedUtilityBillerNg
          : String(selectedUtilityBillerReloadly?.id);
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
    try {
      const billerId =
        utilityCountryCode === 'NG' ? selectedUtilityBillerNg : selectedUtilityBillerReloadly?.id;
      const billerName =
        utilityCountryCode === 'NG'
          ? NG_UTILITIES.find((u) => u.id === selectedUtilityBillerNg)?.name
          : selectedUtilityBillerReloadly?.name;

      const rewardName = `${billerName} Utility Payment`;

      const result = await claimReward.mutateAsync({
        rewardType: utilityCountryCode === 'NG' ? 'NOMBA_UTILITY' : 'RELOADLY_UTILITY',
        rewardId: utilityCountryCode === 'NG' ? 'NOMBA_UTILITY' : 'RELOADLY_UTILITY',
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
          `Utility payment successful! ${result.voucherCode ? `Token: ${result.voucherCode}` : ''}`,
        );
        setUtilityAccountNumber('');
        setLookupResult(null);
      } else if (result.status === 'FAILED') {
        toast.error(result.errorMessage ?? 'Payment failed. Points refunded.');
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

  const giftCards = catalog.filter((i) => i.type === 'RELOADLY');
  const customPerks = catalog.filter((i) => i.type === 'CUSTOM');

  const filteredReloadlyCards = giftCards.filter((item) => {
    const category = getReloadlyCategory(item);
    const isNgAirtime = item.countryCode === 'NG' && category === 'Airtime';
    if (isNgAirtime) return false;

    if (selectedCategory === 'All') return true;
    return category === selectedCategory;
  });

  const filteredAllClaims = allClaims.filter((claim) => {
    if (!claimsSearch.trim()) return true;
    const term = claimsSearch.toLowerCase();
    const nameMatch = claim.rewardName?.toLowerCase().includes(term);
    const memberName = claim.member
      ? `${claim.member.firstName} ${claim.member.lastName}`.toLowerCase()
      : '';
    const phoneMatch = claim.recipientPhone?.toLowerCase().includes(term);
    const emailMatch = claim.recipientEmail?.toLowerCase().includes(term);
    return nameMatch || memberName.includes(term) || phoneMatch || emailMatch;
  });

  const handleClaim = async (item: CatalogItem) => {
    if (pointsBalance && pointsBalance.currentBalance < item.pointsCost) {
      toast.error('Insufficient points balance.');
      return;
    }

    setClaimingId(item.id);
    try {
      const result = await claimReward.mutateAsync({
        rewardType: item.type,
        rewardId: item.id,
        rewardName: item.name,
        pointsCost: item.pointsCost,
        currencyValue: item.currencyValue ?? 0,
        currencyCode: item.currencyCode,
      });

      if (result.status === 'SUCCESS') {
        toast.success(
          `Claim successful! ${result.voucherCode ? `Code: ${result.voucherCode}` : 'Reward ordered.'}`,
        );
      } else if (result.status === 'PENDING') {
        toast.info('Claim pending fulfillment.');
      } else {
        toast.error(result.errorMessage ?? 'Claim failed. Points refunded.');
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
    try {
      const selectedBundle =
        selectedCountryCode === 'NG' && topupMode === 'data'
          ? DATA_BUNDLES[airtimeNetwork].find((b) => b.id === selectedBundleId)
          : null;

      const providerProductId =
        selectedCountryCode !== 'NG' ? selectedReloadlyOperator?.operatorId : undefined;

      const rewardName =
        selectedCountryCode === 'NG'
          ? selectedBundle
            ? `${airtimeNetwork} ${selectedBundle.name} Data Bundle`
            : `${airtimeNetwork} Airtime Top-up`
          : `${selectedReloadlyOperator?.name} Airtime`;

      const result = await claimReward.mutateAsync({
        rewardType: selectedCountryCode === 'NG' ? 'NOMBA_AIRTIME' : 'RELOADLY_AIRTIME',
        rewardId: selectedCountryCode === 'NG' ? 'NOMBA_AIRTIME' : 'RELOADLY_AIRTIME',
        rewardName,
        pointsCost: calculatedPoints,
        currencyValue: amount,
        currencyCode: calculatedCurrency,
        recipientPhone: airtimePhone.trim(),
        airtimeNetwork: selectedCountryCode === 'NG' ? airtimeNetwork : undefined,
        providerProductId,
      });

      if (result.status === 'SUCCESS') {
        toast.success(
          selectedCountryCode === 'NG' && selectedBundle
            ? 'Data bundle sent successfully!'
            : 'Airtime sent successfully!',
        );
        setAirtimePhone('');
      } else if (result.status === 'FAILED') {
        toast.error(result.errorMessage ?? 'Purchase failed. Points refunded.');
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

  if (pointsLoading || catalogLoading) {
    return isTab ? (
      <LoadingBlock />
    ) : (
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  const defaultTab =
    isGiftCardsEnabled && giftCards.length > 0
      ? 'digital-cards'
      : isAirtimeEnabled
        ? 'airtime'
        : isUtilitiesEnabled
          ? 'utilities'
          : 'perks';

  const content = (
    <>
      {!isTab ? (
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Rewards</h1>
          <p className="text-sm text-muted-foreground">
            Redeem your {PAQ_POINTS_NAME.toLowerCase()} for gift cards, airtime, and exclusive perks
          </p>
        </div>
      ) : null}

      <PointsSummaryCard
        balance={pointsBalance?.currentBalance ?? 0}
        totalEarned={pointsBalance?.totalEarned ?? 0}
      />

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="h-auto w-full justify-start flex-wrap gap-1.5 p-1.5 bg-muted/60">
          {isGiftCardsEnabled && giftCards.length > 0 && (
            <TabsTrigger
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 h-auto"
              value="digital-cards"
            >
              <ShoppingBag className="mr-1.5 size-3.5" />
              Digital Cards
            </TabsTrigger>
          )}
          {isAirtimeEnabled && (
            <TabsTrigger
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 h-auto"
              value="airtime"
            >
              <Phone className="mr-1.5 size-3.5" />
              Mobile Top-up
            </TabsTrigger>
          )}
          {isUtilitiesEnabled && (
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

        {isGiftCardsEnabled && giftCards.length > 0 && (
          <TabsContent value="digital-cards" className="space-y-4">
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

                  const count = giftCards.filter((item) => {
                    const isNgAirtime =
                      item.countryCode === 'NG' && getReloadlyCategory(item) === 'Airtime';
                    if (isNgAirtime) return false;
                    if (cat === 'All') return true;
                    return getReloadlyCategory(item) === cat;
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

            {filteredReloadlyCards.length === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                title="No items in this category"
                description="Try switching to another category tab."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredReloadlyCards.map((item) => (
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

        {isAirtimeEnabled && (
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
                  {catalogCountries.length > 1 && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Country:
                      </Label>
                      <Select value={selectedCountryCode} onValueChange={setSelectedCountryCode}>
                        <SelectTrigger className="w-[140px] h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {catalogCountries.map((code) => (
                            <SelectItem key={code} value={code} className="text-xs">
                              {code === 'NG' ? '🇳🇬 Nigeria' : `🌐 ${code}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {selectedCountryCode === 'NG' && (
                    <div className="flex rounded-lg bg-muted p-1 border border-border/40 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setTopupMode('airtime');
                          setAirtimeAmount('1000');
                        }}
                        className={cn(
                          'px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
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
                          const defaultBundle = DATA_BUNDLES[airtimeNetwork][0];
                          setSelectedBundleId(defaultBundle.id);
                          setAirtimeAmount(String(defaultBundle.price));
                        }}
                        className={cn(
                          'px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
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
                                if (topupMode === 'data') {
                                  const defaultBundle = DATA_BUNDLES[key][0];
                                  setSelectedBundleId(defaultBundle.id);
                                  setAirtimeAmount(String(defaultBundle.price));
                                }
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
                      {operatorsLoading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="size-4 animate-spin text-primary" /> Loading
                          Operators...
                        </div>
                      ) : reloadlyOperators.length === 0 ? (
                        <div className="text-xs text-muted-foreground italic">
                          No operators available for this country.
                        </div>
                      ) : (
                        <Select
                          value={selectedReloadlyOperatorId}
                          onValueChange={setSelectedReloadlyOperatorId}
                        >
                          <SelectTrigger className="h-10 text-xs">
                            <SelectValue placeholder="Select operator..." />
                          </SelectTrigger>
                          <SelectContent>
                            {reloadlyOperators.map((operator) => (
                              <SelectItem
                                key={operator.operatorId}
                                value={String(operator.operatorId)}
                                className="text-xs"
                              >
                                {operator.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
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

                    {selectedCountryCode === 'NG'
                      ? topupMode === 'airtime' && (
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
                      : selectedReloadlyOperator && (
                          <div className="space-y-1.5">
                            <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                              Amount ({selectedReloadlyOperator.destinationCurrencyCode})
                            </Label>
                            {selectedReloadlyOperator.denominationType === 'FIXED' ? (
                              <Select value={airtimeAmount} onValueChange={setAirtimeAmount}>
                                <SelectTrigger className="h-10 text-xs font-medium">
                                  <SelectValue placeholder="Select denomination" />
                                </SelectTrigger>
                                <SelectContent>
                                  {selectedReloadlyOperator.localMinAmount === null ? (
                                    <SelectItem value="0" className="text-xs">
                                      No denominations available
                                    </SelectItem>
                                  ) : (
                                    [10, 20, 50, 100].map((val) => (
                                      <SelectItem key={val} value={String(val)} className="text-xs">
                                        {selectedReloadlyOperator.destinationCurrencyCode} {val}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                type="number"
                                min={selectedReloadlyOperator.localMinAmount ?? 1}
                                max={selectedReloadlyOperator.localMaxAmount ?? 1000}
                                value={airtimeAmount}
                                onChange={(e) => setAirtimeAmount(e.target.value)}
                                placeholder={`Range: ${selectedReloadlyOperator.localMinAmount ?? 1} - ${selectedReloadlyOperator.localMaxAmount ?? 1000}`}
                                className="h-10 text-sm font-medium"
                              />
                            )}
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
                        <Select
                          value={selectedBundleId}
                          onValueChange={(val) => {
                            setSelectedBundleId(val);
                            const b = DATA_BUNDLES[airtimeNetwork].find((item) => item.id === val);
                            if (b) setAirtimeAmount(String(b.price));
                          }}
                        >
                          <SelectTrigger className="h-10 text-xs font-medium">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DATA_BUNDLES[airtimeNetwork].map((bundle) => (
                              <SelectItem key={bundle.id} value={bundle.id}>
                                {bundle.name} ({bundle.validity}) — ₦{bundle.price.toLocaleString()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {Number(airtimeAmount) > 0 && (
                      <div className="rounded-xl border border-border/40 bg-card p-4 space-y-3 text-sm shadow-inner">
                        <div className="flex justify-between text-xs text-muted-foreground font-medium">
                          <span>Recharge Value</span>
                          <span className="font-bold text-foreground">
                            {selectedCountryCode === 'NG'
                              ? '₦'
                              : `${selectedReloadlyOperator?.destinationCurrencyCode} `}
                            {Number(airtimeAmount).toLocaleString()}
                          </span>
                        </div>

                        {selectedCountryCode === 'NG' ? (
                          <div className="flex justify-between text-xs text-muted-foreground font-medium">
                            <span>Processing Fee</span>
                            <span className="font-bold text-foreground">
                              +₦{(airtimeProcessingFee ?? 0).toLocaleString()}
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

        {isUtilitiesEnabled && (
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

                {catalogCountries.length > 1 && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground">Country:</Label>
                    <Select value={utilityCountryCode} onValueChange={setUtilityCountryCode}>
                      <SelectTrigger className="w-[140px] h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {catalogCountries.map((code) => (
                          <SelectItem key={code} value={code} className="text-xs">
                            {code === 'NG' ? '🇳🇬 Nigeria' : `🌐 ${code}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 space-y-6">
                  {utilityCountryCode === 'NG' ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Select Biller (Nigeria)
                        </Label>
                        <Select
                          value={selectedUtilityBillerNg}
                          onValueChange={setSelectedUtilityBillerNg}
                        >
                          <SelectTrigger className="h-10 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {NG_UTILITIES.map((u) => (
                              <SelectItem key={u.id} value={u.id} className="text-xs">
                                {u.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Service Type
                        </Label>
                        <Select
                          value={utilityServiceType}
                          onValueChange={(val) =>
                            setUtilityServiceType(val as 'PREPAID' | 'POSTPAID')
                          }
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
                      {billersLoading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="size-4 animate-spin text-primary" /> Loading
                          Billers...
                        </div>
                      ) : reloadlyBillers.length === 0 ? (
                        <div className="text-xs text-muted-foreground italic">
                          No utility billers available for this country.
                        </div>
                      ) : (
                        <Select
                          value={selectedUtilityBillerReloadlyId}
                          onValueChange={setSelectedUtilityBillerReloadlyId}
                        >
                          <SelectTrigger className="h-10 text-xs">
                            <SelectValue placeholder="Select utility biller..." />
                          </SelectTrigger>
                          <SelectContent>
                            {reloadlyBillers.map((biller) => (
                              <SelectItem
                                key={biller.id}
                                value={String(biller.id)}
                                className="text-xs"
                              >
                                {biller.name} ({biller.type})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
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
                            disabled={isLookingUpMeter || !utilityAccountNumber.trim()}
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
                            {utilityCountryCode === 'NG'
                              ? '₦'
                              : `${selectedUtilityBillerReloadly?.localTransactionCurrencyCode || 'USD'} `}
                            {Number(utilityAmount).toLocaleString()}
                          </span>
                        </div>

                        {utilityCountryCode === 'NG' ? (
                          <div className="flex justify-between text-xs text-muted-foreground font-medium">
                            <span>Processing Fee</span>
                            <span className="font-bold text-foreground">
                              +₦{(utilityProcessingFee ?? 0).toLocaleString()}
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
                      (utilityCountryCode === 'NG' && !lookupResult)
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
                {DEFAULT_CUSTOM_PERKS.map((item) => (
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

              {isAdmin && (
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
                    {DEFAULT_CUSTOM_PERKS.map((item) => (
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
                        FAILED: 'bg-red-500/10 text-red-600 border-red-200 dark:border-red-800',
                      };

                      return (
                        <div
                          key={claim.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border/60 bg-card p-4 hover:border-primary/20 transition-all shadow-sm"
                        >
                          <div className="flex items-start gap-3.5 min-w-0">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 shrink-0">
                              {claim.rewardType === 'NOMBA_AIRTIME' ||
                              claim.rewardType === 'RELOADLY_AIRTIME' ? (
                                <Phone className="size-5" />
                              ) : claim.rewardType === 'CUSTOM' ? (
                                <Sparkles className="size-5 text-amber-500" />
                              ) : claim.rewardType === 'NOMBA_UTILITY' ||
                                claim.rewardType === 'RELOADLY_UTILITY' ? (
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

                              {(claim.recipientPhone || claim.recipientEmail) && (
                                <p className="text-[11px] text-muted-foreground mt-1 bg-muted/40 px-2 py-0.5 rounded-md inline-block">
                                  {claim.recipientPhone
                                    ? `📞 ${claim.recipientPhone}`
                                    : `✉️ ${claim.recipientEmail}`}
                                </p>
                              )}

                              {(claim.voucherCode || claim.voucherInstructions) && (
                                <div className="mt-2 text-xs space-y-1 bg-muted/50 p-2.5 rounded-lg border border-border/40">
                                  {claim.voucherCode && (
                                    <p className="font-mono font-bold text-foreground">
                                      Code:{' '}
                                      <span className="select-all bg-background px-1.5 py-0.5 rounded border">
                                        {claim.voucherCode}
                                      </span>
                                      {claim.voucherPin ? ` · PIN: ${claim.voucherPin}` : ''}
                                    </p>
                                  )}
                                  {claim.voucherInstructions && (
                                    <p className="text-[10px] text-muted-foreground italic leading-normal pt-1">
                                      {claim.voucherInstructions}
                                    </p>
                                  )}
                                </div>
                              )}
                              {claim.status === 'FAILED' && claim.errorMessage && (
                                <p className="mt-1 text-[11px] text-red-500 font-semibold leading-tight">
                                  Error: {claim.errorMessage}
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
                              {claim.status === 'PENDING' ? (
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
