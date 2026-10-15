import { apiClient } from '@/lib/api/client';

export interface Plan {
  id: string;
  slug: string;
  name: string;
  description?: string;
  sortOrder?: number;
  features?: Record<string, boolean>;
  limits?: Record<string, number>;
}

export interface PlanPrice {
  id: string;
  slug: string;
  name: string;
  description?: string;
  countryCode: string;
  currency: string;
  monthlyPrice: number;
  yearlyPrice?: number;
  regionalConfig?: Record<string, unknown>;
  features?: Record<string, boolean>;
  limits?: Record<string, number>;
  sortOrder?: number;
}

export interface PlanDetection {
  countryCode: string;
  pricing: PlanPrice[];
}

export async function fetchPlans(): Promise<PlanPrice[]> {
  return apiClient<PlanPrice[]>('/plans');
}

export async function detectPlans(): Promise<PlanDetection> {
  return apiClient<PlanDetection>('/plans/detect');
}

export async function fetchPlansForCountry(countryCode: string): Promise<PlanPrice[]> {
  return apiClient<PlanPrice[]>(`/plans/country/${countryCode.toUpperCase()}`);
}

export async function fetchAdminPlans(): Promise<Plan[]> {
  return apiClient<Plan[]>('/admin/plans');
}

export async function fetchAdminPlanPrices(countryCode?: string): Promise<PlanPrice[]> {
  const params = countryCode ? `?countryCode=${countryCode.toUpperCase()}` : '';
  return apiClient<PlanPrice[]>(`/admin/plans/prices${params}`);
}

export async function upsertPlanPrice(input: {
  slug: string;
  name: string;
  description?: string;
  countryCode: string;
  currency: string;
  monthlyPrice: number;
  yearlyPrice?: number;
  regionalConfig?: Record<string, unknown>;
  features?: Record<string, boolean>;
  limits?: Record<string, number>;
  sortOrder?: number;
}): Promise<PlanPrice> {
  return apiClient<PlanPrice>('/admin/plans/prices', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      countryCode: input.countryCode.toUpperCase(),
      currency: input.currency.toUpperCase(),
    }),
  });
}

export async function updatePlanPrice(
  priceId: string,
  updates: Partial<Omit<PlanPrice, 'id'>>,
): Promise<PlanPrice> {
  return apiClient<PlanPrice>(`/admin/plans/prices/${priceId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}
