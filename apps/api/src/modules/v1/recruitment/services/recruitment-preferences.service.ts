import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';

@Injectable()
export class RecruitmentPreferencesService {
  constructor(@InjectRepository(TenantMember) private readonly members: Repository<TenantMember>) {}

  async get(tenantId: string, memberId: string) {
    const member = await this.members.findOne({
      where: { id: memberId, tenantId },
      select: { id: true, recruitmentAskEmailOnMove: true },
    });
    return { askEmailOnMove: member?.recruitmentAskEmailOnMove ?? true };
  }

  async update(tenantId: string, memberId: string, askEmailOnMove: boolean) {
    await this.members.update(
      { id: memberId, tenantId },
      { recruitmentAskEmailOnMove: askEmailOnMove },
    );
    return { askEmailOnMove };
  }
}
