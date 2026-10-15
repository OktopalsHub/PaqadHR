import { CandidateStatus } from 'src/common/enums';
import type { Candidate } from '../entities/candidate.entity';
import { PublicApplicationMapper } from './public-application-response.dto';

describe('PublicApplicationMapper', () => {
  it('returns only minimal applicant-facing fields', () => {
    const candidate = {
      id: 'app-1',
      jobOpeningId: 'job-1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phone: '+2348000000000',
      tenantId: 'tenant-1',
      status: CandidateStatus.APPLIED,
      currentStage: { name: 'Applied', startedAt: new Date() },
      appliedAt: new Date('2026-01-01T00:00:00.000Z'),
      resume: { filename: 'cv.pdf', uploadedAt: new Date() },
    } as Candidate;

    const response = PublicApplicationMapper.toResponse(candidate);

    expect(response).toEqual({
      id: 'app-1',
      jobOpeningId: 'job-1',
      status: CandidateStatus.APPLIED,
      currentStage: { name: 'Applied' },
      appliedAt: '2026-01-01T00:00:00.000Z',
      withdrawnAt: undefined,
    });
    expect(response).not.toHaveProperty('email');
    expect(response).not.toHaveProperty('phone');
    expect(response).not.toHaveProperty('tenantId');
    expect(response).not.toHaveProperty('resume');
  });
});
