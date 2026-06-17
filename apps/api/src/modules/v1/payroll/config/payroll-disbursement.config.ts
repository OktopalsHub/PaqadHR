import { isNombaConfigured } from '../../../../common/config/nomba.config';

/** Automated Nomba payroll payouts — enabled when Nomba credentials are configured. */
export function isPayrollGatewayEnabled(): boolean {
  return isNombaConfigured();
}
