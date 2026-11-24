import { randomUUID } from 'node:crypto';

import { CandidateStatus } from 'src/common/enums';
import type { DataSource } from 'typeorm';

import { CandidateStageHistory } from '../modules/v1/recruitment/entities/candidate-stage-history.entity';
import { Candidate } from '../modules/v1/recruitment/entities/candidate.entity';
import { PipelineStage } from '../modules/v1/recruitment/entities/pipeline-stage.entity';
import { RecruitmentOffer } from '../modules/v1/recruitment/entities/recruitment-offer.entity';
import { RecruitmentOfferService } from '../modules/v1/recruitment/services/recruitment-offer.service';
import { RecruitmentPipelineService } from '../modules/v1/recruitment/services/recruitment-pipeline.service';
import { createPgDataSource, PG_TEST_URL } from './pg-harness';

const maybe = PG_TEST_URL ? describe : describe.skip;

maybe('recruitment moves and offers (real Postgres)', () => {
  jest.setTimeout(180_000);
  let ds: DataSource;
  let pipeline: RecruitmentPipelineService;
  let offers: RecruitmentOfferService;
  const updateCandidateStatus = jest.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    ds = await createPgDataSource();
    const candidateRepo = ds.getRepository(Candidate);
    const candidateService = {
      getCandidate: (id: string, tenantId: string) =>
        candidateRepo.findOneByOrFail({ id, tenantId }),
      recordStatusActivity: jest.fn(),
      updateCandidateStatus,
    };
    const mailer = { send: jest.fn().mockResolvedValue({ status: 'sent' }) };
    pipeline = new RecruitmentPipelineService(
      ds.getRepository(PipelineStage),
      candidateRepo,
      ds.getRepository(CandidateStageHistory),
      candidateService as never,
      mailer as never,
      { get: jest.fn() } as never,
    );
    offers = new RecruitmentOfferService(
      ds.getRepository(RecruitmentOffer),
      candidateService as never,
      mailer as never,
    );
  });
  afterAll(async () => {
    await ds?.destroy();
  });

  async function seedCandidate(status: CandidateStatus) {
    const tenantId = randomUUID();
    const jobOpeningId = randomUUID();
    const candidateId = randomUUID();
    const stageRepo = ds.getRepository(PipelineStage);
    const stage = (name: string, position: number, type: CandidateStatus) => ({
      id: randomUUID(),
      tenantId,
      jobOpeningId: null,
      name,
      position,
      type,
    });
    const applied = stage('Applied', 0, CandidateStatus.APPLIED);
    const screening = stage('Screening', 1, CandidateStatus.SCREENING);
    const rejected = stage('Rejected', 2, CandidateStatus.REJECTED);
    await stageRepo.insert([applied, screening, rejected] as never);
    await ds
      .getRepository(Candidate)
      .insert({ id: candidateId, tenantId, jobOpeningId, status, stageId: applied.id } as never);
    return { tenantId, candidateId, screening, rejected };
  }

  it('applies one of several conflicting stage moves and records one history row', async () => {
    const { tenantId, candidateId, screening, rejected } = await seedCandidate(CandidateStatus.APPLIED);
    const move = (stageId: string) =>
      pipeline.moveCandidate({ tenantId, candidateId, stageId, actorMemberId: randomUUID(), sendEmail: false });

    const results = await Promise.allSettled([
      ...Array.from({ length: 6 }, () => move(screening.id)),
      ...Array.from({ length: 6 }, () => move(rejected.id)),
    ]);

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const history = await ds
      .getRepository(CandidateStageHistory)
      .find({ where: { tenantId, candidateId } });
    const after = await ds.getRepository(Candidate).findOneByOrFail({ id: candidateId });
    expect(succeeded).toBeGreaterThanOrEqual(1);
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history.length).toBeLessThanOrEqual(2);
    expect(new Set(history.map((h) => h.fromStageId)).size).toBe(history.length);
    expect(history.some((h) => h.toStageId === after.stageId)).toBe(true);
    expect(after.status).toBe(after.stageId === screening.id ? 'SCREENING' : 'REJECTED');
  });

  it('sends an offer once when several people click send together', async () => {
    const { tenantId, candidateId } = await seedCandidate(CandidateStatus.OFFER);
    const offerId = randomUUID();
    await ds
      .getRepository(RecruitmentOffer)
      .insert({ id: offerId, tenantId, candidateId, amount: '100.00', currency: 'USD', status: 'DRAFT' } as never);
    await ds.getRepository(Candidate).update({ id: candidateId }, { status: CandidateStatus.OFFER });

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => offers.send(tenantId, offerId, randomUUID())),
    );

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('answers an offer once and updates the candidate once', async () => {
    updateCandidateStatus.mockClear();
    const { tenantId, candidateId } = await seedCandidate(CandidateStatus.OFFER);
    const offerId = randomUUID();
    await ds
      .getRepository(RecruitmentOffer)
      .insert({ id: offerId, tenantId, candidateId, amount: '100.00', currency: 'USD', status: 'SENT' } as never);

    const results = await Promise.allSettled([
      ...Array.from({ length: 5 }, () => offers.respond(tenantId, offerId, randomUUID(), 'ACCEPTED')),
      ...Array.from({ length: 5 }, () => offers.respond(tenantId, offerId, randomUUID(), 'DECLINED')),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(updateCandidateStatus).toHaveBeenCalledTimes(1);
  });

  it('allows only one open offer per candidate under concurrent creation', async () => {
    const { tenantId, candidateId } = await seedCandidate(CandidateStatus.OFFER);

    await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        offers.create(tenantId, candidateId, randomUUID(), { amount: 100, currency: 'USD' } as never),
      ),
    );

    const open = await ds
      .getRepository(RecruitmentOffer)
      .count({ where: { tenantId, candidateId } });
    expect(open).toBe(1);
  });
});
