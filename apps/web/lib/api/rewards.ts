import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';

/** Maximum wallet top-up amount per checkout or auto-topup request (mirrors API DTO). */
export const WALLET_TOPUP_MAX_AMOUNT = 10_000_000;

export type RewardType = 'TREMENDOUS' | 'NOMBA_AIRTIME' | 'NOMBA_UTILITY' | 'CUSTOM';
export type RedemptionStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

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
  recipient: { email?: string; phone?: string } | null;
  voucher: { code?: string; pin?: string; instructions?: string } | null;
  providerRef: { txRef?: string; error?: string } | null;
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
  /** True once the wallet has balance or transaction history; currency cannot change. */
  currencyLocked?: boolean;
  balanceAmount: number;
  pointsExchangeRate: number;
  feePercentage?: number;
  flatFee?: number;
  autoTopupEnabled: boolean;
  autoTopupThreshold: number;
  autoTopupAmount: number;
  /** True when checkout runs in live mode for the wallet currency. */
  checkoutLive?: boolean;
  /** False when saved-card top-up / auto-topup is unavailable for this workspace. */
  savedCardTopupSupported?: boolean;
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

export interface UpdateCustomRewardInput {
  title?: string;
  description?: string;
  pointsCost?: number;
  imageUrl?: string;
  isActive?: boolean;
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
  /** Client-generated UUID; retries with the same key return the existing redemption. */
  idempotencyKey?: string;
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

export async function fetchRewardsCatalog(countryCode?: string): Promise<CatalogItem[]> {
  const tenantId = await resolveTenantId();
  const query = countryCode ? `?country=${encodeURIComponent(countryCode)}` : '';
  return apiClient<CatalogItem[]>(tenantPath(tenantId, `rewards/catalog${query}`));
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
  Array<
    CustomRewardInput & {
      id: string;
      isActive: boolean;
      deliveryInstructions?: string;
      stockLimit?: number;
    }
  >
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

export async function updateCustomReward(rewardId: string, input: UpdateCustomRewardInput) {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, `rewards/custom/${rewardId}`), {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteCustomReward(rewardId: string) {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, `rewards/custom/${rewardId}`), {
    method: 'DELETE',
  });
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

export type UtilityBiller = {
  id: string | number;
  name: string;
  type?: string;
  localTransactionCurrencyCode?: string;
};

export async function fetchUtilityBillers(countryCode: string): Promise<UtilityBiller[]> {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, `rewards/utilities/billers/${countryCode}`));
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
): Promise<{ checkoutUrl: string; orderReference: string; transactionReference?: string }> {
  return apiClient<{
    checkoutUrl: string;
    orderReference: string;
    transactionReference?: string;
  }>(tenantPath(tenantId, 'rewards/wallet/topup/checkout'), {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

export async function completeWalletTopupCheckout(
  tenantId: string,
  orderReference: string,
  amount?: number,
  transactionReference?: string,
): Promise<{ received: boolean; credited: boolean; retryable?: boolean }> {
  return apiClient<{ received: boolean; credited: boolean; retryable?: boolean }>(
    tenantPath(tenantId, 'rewards/wallet/topup/checkout/complete'),
    {
      method: 'POST',
      body: JSON.stringify({
        orderReference,
        ...(amount != null ? { amount } : {}),
        ...(transactionReference ? { transactionReference } : {}),
      }),
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

export interface RewardProviders {
  tremendous: { giftCards: boolean };
  nomba: { airtime: boolean; utility: boolean };
  monnify: { airtime: boolean; utility: boolean };
}

export async function fetchRewardProviders(): Promise<RewardProviders> {
  const tenantId = await resolveTenantId();
  return apiClient<RewardProviders>(tenantPath(tenantId, 'rewards/providers'));
}
