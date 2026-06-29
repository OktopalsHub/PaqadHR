import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';

export type RewardType = 'RELOADLY' | 'NOMBA_AIRTIME' | 'CUSTOM';
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
  virtualAccountNumber: string | null;
  virtualAccountBank: string | null;
  pointsExchangeRate: number;
  feePercentage?: number;
  flatFee?: number;
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
