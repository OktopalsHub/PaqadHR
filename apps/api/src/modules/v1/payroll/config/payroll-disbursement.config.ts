import { isFincraConfigured } from '../../../../common/config/fincra.config';
import { isMonnifyConfigured } from '../../../../common/config/monnify.config';
import { isNoahConfigured } from '../../../../common/config/noah.config';
import { isNombaConfigured } from '../../../../common/config/nomba.config';

export function isPayrollGatewayEnabled(): boolean {
  return isNombaConfigured() || isNoahConfigured() || isMonnifyConfigured() || isFincraConfigured();
}
