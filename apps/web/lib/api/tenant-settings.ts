import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';
import type { GeneralSettings } from '@/lib/constants/currencies';

export type AllowancePeriod = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface PointsSettings {
  monthlyAllowance: number;
  allowancePeriod?: AllowancePeriod;
  maxPointsPerShoutout: number;
  minPointsPerShoutout: number;
  autoAssignPoints: boolean;
  autoAssignAmount: number;
  startingBalance?: number;
  dailyLimit?: number;
  monthlyLimit?: number;
}

export interface ShoutoutCelebrationTemplate {
  enabled: boolean;
  points: number;
  messageTemplate: string;
}

export interface ShoutoutSettings {
  maxRecipientsPerShoutout?: number;
  enableCategories?: boolean;
  birthday?: ShoutoutCelebrationTemplate;
  workAnniversary?: ShoutoutCelebrationTemplate;
}

export interface HolidayItem {
  id: string;
  name: string;
  date: string;
  type?: 'national' | 'religious' | 'custom';
  recurring?: boolean;
}

export interface HolidaySettings {
  countryCode?: string;
  customHolidays?: HolidayItem[];
  excludeWeekends?: boolean;
  suggestedCountryCode?: string;
}

export interface HolidayCountry {
  code: string;
  name: string;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  slackNotifications: boolean;
  webhookUrl?: string;
}

export interface AttendanceSettings {
  weekends: number[];
  clockInEnabled?: boolean;
}

export interface BillingSettings {
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  country?: string;
  monnifyBvn?: string;
  monnifyNin?: string;
  hasMonnifyBvn?: boolean;
  hasMonnifyNin?: boolean;
}

export interface RewardsSettings {
  enabled: boolean;
  pointsExchangeRate: number;
  rewardsCurrency: string;
  catalogCountries: string[];
  airtimeEnabled: boolean;
  customRewardsEnabled: boolean;
  giftCardsEnabled?: boolean;
  giftCardCategories?: string[];
  utilityPaymentsEnabled?: boolean;
  reloadlyProducts?: Array<{
    productId: number;
    name: string;
    pointsCost: number;
    imageUrl: string | null;
    countryCode: string;
    currencyCode: string;
    minDenomination?: number | null;
    maxDenomination?: number | null;
    fixedDenominations?: number[];
    listReloadlyCost?: number | null;
    listReloadlyCostCurrency?: string;
    wholesaleInRewardsCurrency?: number;
  }>;
}

export interface TenantSettingsData {
  points?: PointsSettings;
  shoutouts?: ShoutoutSettings;
  holidays?: HolidaySettings;
  notifications?: NotificationSettings;
  attendance?: AttendanceSettings;
  billing?: BillingSettings;
  general?: GeneralSettings;
  rewards?: RewardsSettings;
}

export interface TenantSettingsResponse {
  id: string;
  tenantId: string;
  settings: TenantSettingsData;
}

export interface MemberPointsRow {
  memberId: string;
  firstName: string | null;
  lastName: string | null;
  currentBalance: number;
  totalEarned: number;
  totalGiven: number;
  monthlyGiven: number;
  monthlyReceived: number;
}

export async function fetchTenantSettings(): Promise<TenantSettingsResponse> {
  const tenantId = await resolveTenantId();
  return apiClient<TenantSettingsResponse>(tenantPath(tenantId, 'settings'));
}

export async function patchTenantSettings(
  patch: Partial<TenantSettingsData>,
): Promise<TenantSettingsResponse> {
  const tenantId = await resolveTenantId();
  return apiClient<TenantSettingsResponse>(tenantPath(tenantId, 'settings'), {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function fetchMembersPoints(): Promise<MemberPointsRow[]> {
  const tenantId = await resolveTenantId();
  return apiClient<MemberPointsRow[]>(tenantPath(tenantId, 'settings/members-points'));
}

export async function assignPointsToAll(points: number, reason?: string) {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, 'settings/assign-points'), {
    method: 'POST',
    body: JSON.stringify({ points, reason }),
  });
}

export async function fetchHolidaySettings(): Promise<HolidaySettings> {
  const tenantId = await resolveTenantId();
  return apiClient<HolidaySettings>(tenantPath(tenantId, 'settings/holidays'));
}

export async function updateHolidaySettings(holidays: HolidaySettings) {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, 'settings/holidays'), {
    method: 'PATCH',
    body: JSON.stringify(holidays),
  });
}

export async function addCustomHoliday(holiday: Omit<HolidayItem, 'id'>) {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, 'settings/holidays/custom'), {
    method: 'POST',
    body: JSON.stringify(holiday),
  });
}

export async function removeCustomHoliday(holidayId: string) {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, `settings/holidays/custom/${holidayId}`), {
    method: 'DELETE',
  });
}

export async function fetchSupportedHolidayCountries(): Promise<{ countries: HolidayCountry[] }> {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, 'settings/holidays/countries'));
}
