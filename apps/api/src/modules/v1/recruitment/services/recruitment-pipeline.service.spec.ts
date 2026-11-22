import { CandidateStatus } from 'src/common/enums';

import { RecruitmentPipelineService } from './recruitment-pipeline.service';

describe('RecruitmentPipelineService.moveCandidate', () => {
  const stage = {
    id: 'stage-2',
    name: 'Interview',
    type: CandidateStatus.INTERVIEW,
    jobOpeningId: null,
    autoEmailTemplateId: 'template-stage',
  };
  const candidate = {
    id: 'cand-1',
    jobOpeningId: 'job-1',
    stageId: 'stage-1',
    status: CandidateStatus.INTERVIEW,
  };

  let affected: number;
  let historySaved: jest.Mock;
  let mailerSend: jest.Mock;
  let assertTemplate: jest.Mock;
  let service: RecruitmentPipelineService;

  beforeEach(() => {
    affected = 1;
    historySaved = jest.fn();
    mailerSend = jest.fn().mockResolvedValue(undefined);
    const qb: Record<string, jest.Mock> = {};
    for (const m of ['update', 'set', 'where', 'andWhere']) qb[m] = jest.fn().mockReturnValue(qb);
    qb.execute = jest.fn(async () => ({ affected }));
    const manager = {
      getRepository: () => ({ createQueryBuilder: () => qb }),
      create: jest.fn((_e, v) => v),
      save: historySaved,
    };
    assertTemplate = jest.fn().mockResolvedValue(undefined);
    service = new RecruitmentPipelineService(
      { findOne: jest.fn().mockResolvedValue(stage) } as never,
      {
        update: jest.fn().mockResolvedValue(undefined),
        manager: { transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)) },
      } as never,
      { create: jest.fn((v) => v), save: jest.fn().mockResolvedValue(undefined) } as never,
      {
        getCandidate: jest.fn().mockResolvedValue(candidate),
        recordStatusActivity: jest.fn(),
      } as never,
      { send: mailerSend } as never,
      { get: assertTemplate } as never,
    );
  });

  const move = (extra: { sendEmail?: boolean; emailTemplateId?: string } = {}) =>
    service.moveCandidate({
      tenantId: 'tenant-1',
      candidateId: candidate.id,
      stageId: stage.id,
      actorMemberId: 'member-1',
      ...extra,
    });

  it("sends the stage's automatic email when nothing is specified", async () => {
    await move();
    expect(mailerSend).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: 'template-stage', trigger: 'stage' }),
    );
  });

  it('sends the chosen template instead of the stage default', async () => {
    await move({ emailTemplateId: 'template-chosen' });
    expect(assertTemplate).toHaveBeenCalledWith('tenant-1', 'template-chosen');
    expect(mailerSend).toHaveBeenCalledTimes(1);
    expect(mailerSend).toHaveBeenCalledWith(expect.objectContaining({ templateId: 'template-chosen' }));
  });

  it('sends nothing when the recruiter opts out', async () => {
    await move({ sendEmail: false });
    expect(mailerSend).not.toHaveBeenCalled();
  });

  it('does not move the candidate when the chosen template is not theirs', async () => {
    assertTemplate.mockRejectedValue(new Error('not found'));
    await expect(move({ emailTemplateId: 'foreign' })).rejects.toThrow('not found');
    expect(mailerSend).not.toHaveBeenCalled();
  });

  it('records history with the move and refuses when someone else moved the candidate first', async () => {
    await move();
    expect(historySaved).toHaveBeenCalledTimes(1);
    affected = 0;
    historySaved.mockClear();
    await expect(move()).rejects.toThrow('moved by someone else');
    expect(historySaved).not.toHaveBeenCalled();
    expect(mailerSend).toHaveBeenCalledTimes(1);
  });
});
