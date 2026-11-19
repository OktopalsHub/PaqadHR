import { isBridgeConfigured } from '../../../../common/config/bridge.config';
import { isNombaConfigured } from '../../../../common/config/nomba.config';

export function isPayrollGatewayEnabled(): boolean {
  return isNombaConfigured() || isBridgeConfigured();
}
