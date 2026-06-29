import { type CanActivate, ForbiddenException, Injectable } from '@nestjs/common';
import { isBillingGatewayEnabled } from '../config/billing.config';

@Injectable()
export class BillingGatewayGuard implements CanActivate {
  canActivate(): boolean {
    if (!isBillingGatewayEnabled()) {
      throw new ForbiddenException(
        'Card billing is not enabled. Contact support or use admin activation.',
      );
    }
    return true;
  }
}
