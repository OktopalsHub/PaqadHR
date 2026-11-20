import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Candidate } from '../entities/candidate.entity';

@Injectable()
export class RecruitmentTalentPoolService {
  constructor(@InjectRepository(Candidate) private readonly candidates: Repository<Candidate>) {}

  async setMembership(tenantId: string, candidateId: string, inPool: boolean) {
    const result = await this.candidates.update(
      { id: candidateId, tenantId },
      { talentPool: inPool },
    );
    if (!result.affected) throw new NotFoundException('Candidate not found');
    return { candidateId, inPool };
  }

  list(tenantId: string) {
    return this.candidates.find({
      where: { tenantId, talentPool: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        skills: true,
        status: true,
        jobOpeningId: true,
        appliedAt: true,
      },
      order: { appliedAt: 'DESC' },
      take: 200,
    });
  }
}
