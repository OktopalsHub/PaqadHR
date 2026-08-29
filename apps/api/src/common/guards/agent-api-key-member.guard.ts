import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { IAuthenticatedMemberRequest } from 'src/common/interfaces';
import { resolveApiKeyMemberContext } from 'src/common/utils/api-key-member-context.util';
import { Repository } from 'typeorm';
import { Tenant } from '../../modules/v1/tenants/entities/tenant.entity';
import { TenantMembersService } from '../../modules/v1/tenant-members/tenant-members.service';

@Injectable()
export class AgentApiKeyMemberGuard implements CanActivate {
  constructor(
    private readonly tenantMemberService: TenantMembersService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<IAuthenticatedMemberRequest>();
    const tenantId = request.auth?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('API key tenant context missing');
    }

    await resolveApiKeyMemberContext(
      request,
      tenantId,
      this.tenantMemberService,
      this.tenantRepository,
    );
    return true;
  }
}
