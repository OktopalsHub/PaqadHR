import type { TenantSettingsData } from 'src/common/interfaces/tenant-settings-data.interface';

export function serializeTenantSettings<T extends { settings: TenantSettingsData }>(payload: T): T {
  if (!payload.settings.billing) {
    return payload;
  }

  const billing = payload.settings.billing;
  return {
    ...payload,
    settings: {
      ...payload.settings,
      billing: {
        ...billing,
        identityBvn: undefined,
        identityNin: undefined,
        monnifyBvn: undefined,
        monnifyNin: undefined,
        hasIdentityBvn: Boolean(billing.identityBvn ?? billing.monnifyBvn),
        hasIdentityNin: Boolean(billing.identityNin ?? billing.monnifyNin),
      },
    },
  };
}
