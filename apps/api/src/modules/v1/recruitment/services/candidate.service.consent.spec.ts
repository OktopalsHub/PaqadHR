import { BadRequestException } from '@nestjs/common';
import { getPrivacyPolicyVersion } from 'src/common/config/privacy.config';
import { CandidateService } from './candidate.service';

describe('CandidateService.applyForJob consent', () => {
  const createService = () => {
    const candidateRepository = {
      findByEmailAndJob: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation(async (entity) => ({ id: 'cand-1', ...entity })),
    };
    const jobOpeningService = {
      getActiveJob: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
    };
    const activitiesService = { queueActivity: jest.fn() };
    const service = new CandidateService(
      candidateRepository as never,
      jobOpeningService as never,
      activitiesService as never,
    );
    return { service, candidateRepository };
  };

  const baseDto = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    resumeFilename: 'resume.pdf',
  };

  it('rejects applications without dataProcessingConsent', async () => {
    const { service, candidateRepository } = createService();

    await expect(
      service.applyForJob('job-1', { ...baseDto, dataProcessingConsent: false } as never),
    ).rejects.toThrow(BadRequestException);
    expect(candidateRepository.save).not.toHaveBeenCalled();
  });

  it('persists server timestamp and configured policy version on consent', async () => {
    const { service, candidateRepository } = createService();
    const before = Date.now();

    await service.applyForJob('job-1', {
      ...baseDto,
      dataProcessingConsent: true,
    } as never);

    expect(candidateRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customAnswers: expect.objectContaining({
          _privacyConsent: expect.objectContaining({
            privacyPolicyVersion: getPrivacyPolicyVersion(),
            dataProcessingConsentAt: expect.any(String),
          }),
        }),
      }),
    );
    const consentAt = (
      candidateRepository.create.mock.calls[0][0] as {
        customAnswers: { _privacyConsent: { dataProcessingConsentAt: string } };
      }
    ).customAnswers._privacyConsent.dataProcessingConsentAt;
    const parsed = Date.parse(consentAt);
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(Date.now());
  });
});
