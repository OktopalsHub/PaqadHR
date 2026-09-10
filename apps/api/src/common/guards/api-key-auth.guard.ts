import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { ApiKeyScope } from '@paqadhr/contracts';
import { ApiKeysService } from '../../modules/v1/api-keys/services/api-keys.service';
import type { IAuthenticatedUserRequest } from '../interfaces';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<IAuthenticatedUserRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer paq_')) {
      throw new UnauthorizedException('Invalid API key');
    }

    const rawKey = header.slice('Bearer '.length).trim();
    const apiKey = await this.apiKeysService.validateKey(rawKey);
    if (!apiKey?.createdByMember?.user) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    const user = apiKey.createdByMember.user;
    request.auth = {
      principalId: user.id,
      email: user.email,
      role: 'api_key',
      authType: 'api_key',
      apiKeyId: apiKey.id,
      tenantId: apiKey.tenantId,
      memberId: apiKey.createdByMemberId,
      scopes: apiKey.scopes as ApiKeyScope[],
    };

    return true;
  }
}
