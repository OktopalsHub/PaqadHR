import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureAccess } from '../enums/subscription.enum';
import { FEATURES_KEY } from '../decorators/feature-access.decorator';
import { SubscriptionsService } from '../../modules/v1/subscriptions/services/subscriptions.service';

@Injectable()
export class FeatureAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeatures = this.reflector.getAllAndOverride<FeatureAccess[]>(
      FEATURES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredFeatures?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined =
      request.params?.tenantId ?? request.tenant?.id;
    if (!tenantId) {
      throw new ForbiddenException('Tenant context required for this feature');
    }

    const hasAccess = await this.subscriptionsService.hasFeatureAccess(
      tenantId,
      requiredFeatures,
    );
    if (!hasAccess) {
      throw new ForbiddenException({
        message: 'This feature is not available on your current plan or trial',
        code: 'FEATURE_NOT_AVAILABLE',
        requiredFeatures,
      });
    }

    return true;
  }
}
