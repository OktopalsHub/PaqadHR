import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';

export type RewardType =
  | 'RELOADLY'
  | 'NOMBA_AIRTIME'
  | 'RELOADLY_AIRTIME'
  | 'NOMBA_UTILITY'
  | 'RELOADLY_UTILITY'
  | 'CUSTOM';
export type RedemptionStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface CatalogItem {
  id: string;
  name: string;
  type: RewardType;
  pointsCost: number;
  currencyValue: number;
  currencyCode: string;
  countryCode?: string;
  imageUrl?: string | null;
  denominationType?: string;
  minDenomination?: number | null;
  maxDenomination?: number | null;
  fixedDenominations?: number[];
  deliveryInstructions?: string | null;
  stockLimit?: number | null;
  description?: string | null;
  adminPricing?: {
    reloadlyCost: number;
    reloadlyCostCurrency: string;
  };
}

export interface RewardRedemption {
  id: string;
  tenantId: string;
  memberId: string;
  rewardType: RewardType;
  rewardId: string | null;
  rewardName: string | null;
  pointsSpent: number;
  currencyValue: number;
  currencyCode: string;
  status: RedemptionStatus;
  recipientEmail: string | null;
  recipientPhone: string | null;
  voucherCode: string | null;
  voucherPin: string | null;
  voucherInstructions: string | null;
  providerTxRef: string | null;
  errorMessage: string | null;
  createdAt: string;
  member?: {
    firstName: string;
    lastName: string;
    preferredName?: string;
    email: string;
  };
}

export interface TenantWallet {
  id: string;
  tenantId: string;
  currencyCode: string;
  balanceAmount: number;
  pointsExchangeRate: number;
  feePercentage?: number;
  flatFee?: number;
  autoTopupEnabled: boolean;
  autoTopupThreshold: number;
  autoTopupAmount: number;
  /** Checkout provider for wallet currency (`nomba` | `noah`). */
  checkoutProvider?: 'nomba' | 'noah';
  checkoutProviderLabel?: string;
  /** True when checkout runs in live mode for the wallet currency provider. */
  checkoutLive?: boolean;
  /** @deprecated use checkoutLive */
  nombaLive?: boolean;
}

export interface TenantWalletTransaction {
  id: string;
  type: 'DEPOSIT' | 'SPENT' | 'REFUND';
  amount: number;
  reference: string | null;
  description: string | null;
  status?: string;
  createdAt: string;
}

export interface CustomRewardInput {
  title: string;
  description?: string;
  pointsCost: number;
  imageUrl?: string;
  stockLimit?: number;
  deliveryInstructions?: string;
}

export interface ClaimInput {
  rewardType: RewardType;
  rewardId: string;
  rewardName?: string;
  pointsCost: number;
  currencyValue: number;
  currencyCode?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  providerProductId?: number;
  airtimeNetwork?: 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE';
  topupKind?: 'airtime' | 'data';
  billerId?: string | number;
  accountNumber?: string;
  serviceType?: string;
}

export async function syncRewardsCatalog(): Promise<{ synced: number }> {
  const tenantId = await resolveTenantId();
  return apiClient<{ synced: number }>(tenantPath(tenantId, 'rewards/catalog/sync'), {
    method: 'POST',
  });
}

export async function fetchRewardsCatalog(): Promise<CatalogItem[]> {
  const tenantId = await resolveTenantId();
  return apiClient<CatalogItem[]>(tenantPath(tenantId, 'rewards/catalog'));
}

export async function claimReward(input: ClaimInput): Promise<RewardRedemption> {
  const tenantId = await resolveTenantId();
  return apiClient<RewardRedemption>(tenantPath(tenantId, 'rewards/claim'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchMyClaims(): Promise<RewardRedemption[]> {
  const tenantId = await resolveTenantId();
  return apiClient<RewardRedemption[]>(tenantPath(tenantId, 'rewards/claims/me'));
}

export async function fetchAllClaims(): Promise<RewardRedemption[]> {
  const tenantId = await resolveTenantId();
  return apiClient<RewardRedemption[]>(tenantPath(tenantId, 'rewards/claims'));
}

export async function fetchTenantWallet(): Promise<TenantWallet> {
  const tenantId = await resolveTenantId();
  return apiClient<TenantWallet>(tenantPath(tenantId, 'rewards/wallet'));
}

export async function fetchWalletTransactions(): Promise<TenantWalletTransaction[]> {
  const tenantId = await resolveTenantId();
  return apiClient<TenantWalletTransaction[]>(tenantPath(tenantId, 'rewards/wallet/transactions'));
}

export async function fetchCustomRewards(): Promise<
  Array<CustomRewardInput & { id: string; isActive: boolean }>
> {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, 'rewards/custom'));
}

export async function createCustomReward(input: CustomRewardInput) {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, 'rewards/custom'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteCustomReward(rewardId: string) {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, `rewards/custom/${rewardId}`), {
    method: 'DELETE',
  });
}

export interface ReloadlyCountry {
  code: string;
  name: string;
}

export async function fetchReloadlyCountries(): Promise<ReloadlyCountry[]> {
  const tenantId = await resolveTenantId();
  return apiClient<ReloadlyCountry[]>(tenantPath(tenantId, 'rewards/countries'));
}

export interface ReloadlyOperator {
  operatorId: number;
  name: string;
  bundle: boolean;
  data: boolean;
  pin: boolean;
  denominationType: string;
  senderCurrencyCode: string;
  destinationCurrencyCode: string;
  minAmount: number | null;
  maxAmount: number | null;
  localMinAmount: number | null;
  localMaxAmount: number | null;
  logoUrls: string[];
}

export interface ReloadlyBiller {
  id: number;
  name: string;
  countryIsoCode: string;
  type: string;
  serviceType: 'POSTPAID' | 'PREPAID';
  localAmountSupported: boolean;
  localTransactionCurrencyCode: string;
  minLocalTransactionAmount: number | null;
  maxLocalTransactionAmount: number | null;
}

export interface NombaDataPlan {
  amount: number;
  plan: string;
}

export async function fetchNombaDataPlans(
  network: 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE',
): Promise<NombaDataPlan[]> {
  const tenantId = await resolveTenantId();
  return apiClient<NombaDataPlan[]>(tenantPath(tenantId, `rewards/data-plans/${network}`));
}

export async function fetchTopupOperators(countryCode: string): Promise<ReloadlyOperator[]> {
  const tenantId = await resolveTenantId();
  return apiClient<ReloadlyOperator[]>(tenantPath(tenantId, `rewards/operators/${countryCode}`));
}

export async function fetchUtilityBillers(countryCode: string): Promise<ReloadlyBiller[]> {
  const tenantId = await resolveTenantId();
  return apiClient<ReloadlyBiller[]>(
    tenantPath(tenantId, `rewards/utilities/billers/${countryCode}`),
  );
}

export async function lookupUtilityMeter(params: {
  countryCode: string;
  billerId: string;
  accountNumber: string;
  serviceType?: string;
}): Promise<{
  customerName: string | null;
  meterNumber: string | null;
  address: string | null;
  billerId: string | null;
}> {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, 'rewards/utilities/lookup'), {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function calculatePointsCost(params: {
  type: 'airtime' | 'utility' | 'ng-airtime' | 'ng-utility';
  billerId: number;
  amount: number;
}): Promise<{
  pointsCost: number;
  currencyValue: number;
  currencyCode: string;
  totalTenantDebit: number;
  processingFee?: number;
}> {
  const tenantId = await resolveTenantId();
  const query = new URLSearchParams({
    type: params.type,
    amount: String(params.amount),
  });
  if (params.billerId) {
    query.set('billerId', String(params.billerId));
  }
  return apiClient(tenantPath(tenantId, `rewards/calculate-points?${query.toString()}`));
}

export async function manualTopupWallet(tenantId: string, amount: number): Promise<TenantWallet> {
  return apiClient<TenantWallet>(tenantPath(tenantId, 'rewards/wallet/topup'), {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

export async function createWalletTopupCheckout(
  tenantId: string,
  amount: number,
): Promise<{ checkoutUrl: string; orderReference: string }> {
  return apiClient<{ checkoutUrl: string; orderReference: string }>(
    tenantPath(tenantId, 'rewards/wallet/topup/checkout'),
    {
      method: 'POST',
      body: JSON.stringify({ amount }),
    },
  );
}

export async function updateAutoTopupConfig(params: {
  enabled: boolean;
  threshold: number;
  amount: number;
}): Promise<TenantWallet> {
  const tenantId = await resolveTenantId();
  return apiClient<TenantWallet>(tenantPath(tenantId, 'rewards/wallet/auto-topup'), {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function assignPoints(params: {
  memberIds: string[];
  points: number;
  reason?: string;
  assignments?: { memberId: string; points: number }[];
}) {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, 'rewards/assign-points'), {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
