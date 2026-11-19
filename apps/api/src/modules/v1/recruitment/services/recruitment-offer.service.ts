import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CandidateStatus } from 'src/common/enums';
import { Repository } from 'typeorm';

import { CreateOfferDto } from '../dto/recruitment-extras.dto';
import { RecruitmentOffer } from '../entities/recruitment-offer.entity';
import { CandidateService } from './candidate.service';
import { RecruitmentCandidateMailer } from './recruitment-candidate-mailer.service';

const OFFER_COLUMNS = {
  id: true,
  amount: true,
  currency: true,
  startDate: true,
  status: true,
  notes: true,
  sentAt: true,
  respondedAt: true,
  createdAt: true,
} as const;

@Injectable()
export class RecruitmentOfferService {
  constructor(
    @InjectRepository(RecruitmentOffer) private readonly offers: Repository<RecruitmentOffer>,
    private readonly candidateService: CandidateService,
    private readonly mailer: RecruitmentCandidateMailer,
  ) {}

  list(tenantId: string, candidateId: string) {
    return this.offers.find({
      where: { tenantId, candidateId },
      select: OFFER_COLUMNS,
      order: { createdAt: 'DESC' },
    });
  }

  async create(tenantId: string, candidateId: string, memberId: string, dto: CreateOfferDto) {
    await this.candidateService.getCandidate(candidateId, tenantId);
    const offer = await this.offers.save(
      this.offers.create({
        tenantId,
        candidateId,
        amount: dto.amount.toFixed(2),
        currency: dto.currency.toUpperCase(),
        startDate: dto.startDate ?? null,
        notes: dto.notes ?? null,
        status: 'DRAFT',
        createdByMemberId: memberId,
      }),
    );
    return this.get(tenantId, offer.id);
  }

  async send(tenantId: string, offerId: string, memberId: string, templateId?: string) {
    const offer = await this.get(tenantId, offerId);
    if (offer.status !== 'DRAFT') throw new BadRequestException('Only draft offers can be sent');
    const candidate = await this.candidateService.getCandidate(offer.candidateId, tenantId);
    if (candidate.status !== CandidateStatus.OFFER) {
      throw new BadRequestException(
        'Move the candidate to the Offer stage before sending an offer',
      );
    }
    if (templateId) {
      const log = await this.mailer.send({
        tenantId,
        candidateId: candidate.id,
        templateId,
        actorMemberId: memberId,
        trigger: 'manual',
      });
      if (log.status !== 'sent') throw new BadRequestException('The offer email could not be sent');
    }
    await this.offers.update({ id: offerId, tenantId }, { status: 'SENT', sentAt: new Date() });
    return this.get(tenantId, offerId);
  }

  async respond(
    tenantId: string,
    offerId: string,
    memberId: string,
    outcome: 'ACCEPTED' | 'DECLINED',
  ) {
    const offer = await this.get(tenantId, offerId);
    if (offer.status !== 'SENT') throw new BadRequestException('Only sent offers can be answered');
    await this.candidateService.updateCandidateStatus(
      offer.candidateId,
      tenantId,
      { status: outcome === 'ACCEPTED' ? CandidateStatus.HIRED : CandidateStatus.WITHDRAWN },
      memberId,
    );
    await this.offers.update(
      { id: offerId, tenantId },
      { status: outcome, respondedAt: new Date() },
    );
    return this.get(tenantId, offerId);
  }

  private async get(tenantId: string, id: string) {
    const offer = await this.offers.findOne({
      where: { id, tenantId },
      select: { ...OFFER_COLUMNS, candidateId: true },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }
}
