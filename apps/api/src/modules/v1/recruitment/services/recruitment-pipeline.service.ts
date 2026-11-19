import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CandidateStatus } from 'src/common/enums';
import { IsNull, Repository } from 'typeorm';

import { CandidateStageHistory } from '../entities/candidate-stage-history.entity';
import { Candidate } from '../entities/candidate.entity';
import { PipelineStage } from '../entities/pipeline-stage.entity';
import { CandidateService } from './candidate.service';
import { RecruitmentCandidateMailer } from './recruitment-candidate-mailer.service';
import { RecruitmentEmailTemplateService } from './recruitment-email-template.service';

const DEFAULT_STAGES: Array<{ name: string; type: CandidateStatus }> = [
  { name: 'Applied', type: CandidateStatus.APPLIED },
  { name: 'Screening', type: CandidateStatus.SCREENING },
  { name: 'Interview', type: CandidateStatus.INTERVIEW },
  { name: 'Offer', type: CandidateStatus.OFFER },
  { name: 'Hired', type: CandidateStatus.HIRED },
  { name: 'Rejected', type: CandidateStatus.REJECTED },
];

export type StageInput = {
  name: string;
  type: CandidateStatus;
  autoEmailTemplateId?: string | null;
};

@Injectable()
export class RecruitmentPipelineService {
  constructor(
    @InjectRepository(PipelineStage) private readonly stages: Repository<PipelineStage>,
    @InjectRepository(Candidate) private readonly candidates: Repository<Candidate>,
    @InjectRepository(CandidateStageHistory)
    private readonly history: Repository<CandidateStageHistory>,
    private readonly candidateService: CandidateService,
    private readonly mailer: RecruitmentCandidateMailer,
    private readonly templates: RecruitmentEmailTemplateService,
  ) {}

  async getStages(tenantId: string, jobOpeningId: string | null = null): Promise<PipelineStage[]> {
    if (jobOpeningId) {
      const own = await this.stages.find({
        where: { tenantId, jobOpeningId },
        order: { position: 'ASC' },
      });
      if (own.length > 0) return own;
    }
    const defaults = await this.stages.find({
      where: { tenantId, jobOpeningId: IsNull() },
      order: { position: 'ASC' },
    });
    if (defaults.length > 0) return defaults;
    return this.stages.save(
      DEFAULT_STAGES.map((stage, position) =>
        this.stages.create({ ...stage, tenantId, jobOpeningId: null, position }),
      ),
    );
  }

  async addStage(tenantId: string, input: StageInput, jobOpeningId: string | null = null) {
    await this.assertTemplate(tenantId, input.autoEmailTemplateId);
    const existing = await this.getStages(tenantId, jobOpeningId);
    const scoped = existing.filter((stage) => stage.jobOpeningId === jobOpeningId);
    const base =
      scoped.length > 0 ? scoped : await this.cloneIntoJob(tenantId, jobOpeningId, existing);
    return this.stages.save(
      this.stages.create({ ...input, tenantId, jobOpeningId, position: base.length }),
    );
  }

  async updateStage(tenantId: string, stageId: string, input: Partial<StageInput>) {
    const stage = await this.findStage(tenantId, stageId);
    await this.assertTemplate(tenantId, input.autoEmailTemplateId);
    await this.stages.update({ id: stage.id, tenantId }, input);
    return this.findStage(tenantId, stageId);
  }

  async reorder(tenantId: string, orderedIds: string[], jobOpeningId: string | null = null) {
    const current = await this.getStages(tenantId, jobOpeningId);
    const ids = new Set(current.map((stage) => stage.id));
    if (orderedIds.length !== ids.size || orderedIds.some((id) => !ids.has(id))) {
      throw new BadRequestException('Reorder must list every stage in the pipeline exactly once');
    }
    await this.stages.manager.transaction(async (manager) => {
      for (const [position, id] of orderedIds.entries()) {
        await manager.update(PipelineStage, { id, tenantId }, { position });
      }
    });
    return this.getStages(tenantId, jobOpeningId);
  }

  async removeStage(tenantId: string, stageId: string) {
    const stage = await this.findStage(tenantId, stageId);
    const inUse = await this.candidates.count({ where: { tenantId, stageId } });
    if (inUse > 0) {
      throw new BadRequestException('Move candidates out of this stage before deleting it');
    }
    await this.stages.delete({ id: stage.id, tenantId });
  }

  async moveCandidate(input: {
    tenantId: string;
    candidateId: string;
    stageId: string;
    actorMemberId: string;
    actorName?: string;
    reason?: string;
  }) {
    const candidate = await this.candidateService.getCandidate(input.candidateId, input.tenantId);
    const stage = await this.findStage(input.tenantId, input.stageId);
    if (stage.jobOpeningId && stage.jobOpeningId !== candidate.jobOpeningId) {
      throw new BadRequestException('Stage belongs to a different job');
    }
    if (candidate.stageId === stage.id) return candidate;

    if (candidate.status !== stage.type) {
      await this.candidateService.updateCandidateStatus(
        candidate.id,
        input.tenantId,
        { status: stage.type },
        input.actorMemberId,
      );
    }
    await this.candidates.update(
      { id: candidate.id, tenantId: input.tenantId },
      { stageId: stage.id, currentStage: { name: stage.name, startedAt: new Date() } },
    );
    await this.history.save(
      this.history.create({
        tenantId: input.tenantId,
        candidateId: candidate.id,
        fromStageId: candidate.stageId,
        toStageId: stage.id,
        actorMemberId: input.actorMemberId,
        reason: input.reason?.slice(0, 500) ?? null,
      }),
    );

    if (stage.autoEmailTemplateId) {
      await this.mailer
        .send({
          tenantId: input.tenantId,
          candidateId: candidate.id,
          templateId: stage.autoEmailTemplateId,
          actorMemberId: input.actorMemberId,
          actorName: input.actorName,
          stageName: stage.name,
          trigger: 'stage',
        })
        .catch(() => undefined);
    }
    return this.candidateService.getCandidate(candidate.id, input.tenantId);
  }

  stageHistory(tenantId: string, candidateId: string) {
    return this.history.find({
      where: { tenantId, candidateId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  private async assertTemplate(tenantId: string, templateId?: string | null) {
    if (templateId) await this.templates.get(tenantId, templateId);
  }

  private async findStage(tenantId: string, stageId: string) {
    const stage = await this.stages.findOne({ where: { id: stageId, tenantId } });
    if (!stage) throw new NotFoundException('Pipeline stage not found');
    return stage;
  }

  private async cloneIntoJob(
    tenantId: string,
    jobOpeningId: string | null,
    source: PipelineStage[],
  ) {
    return this.stages.save(
      source.map((stage, position) =>
        this.stages.create({
          tenantId,
          jobOpeningId,
          name: stage.name,
          type: stage.type,
          position,
          autoEmailTemplateId: stage.autoEmailTemplateId,
        }),
      ),
    );
  }
}
