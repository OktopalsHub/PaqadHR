import { Tenant } from "../../modules/v1/tenants/entities/tenant.entity";

export interface OnboardingResult {
    tenant: Tenant;
    pricingRegion: {
        countryCode: string;
        region: string;
        currency: string;
        detectionMethod: 'user_selected' | 'ip_detected' | 'default';
        isLocked: boolean;
        };
    subscription?: unknown;
}
