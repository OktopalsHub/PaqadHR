import { ConflictException } from '@nestjs/common';
import { CandidateStatus } from 'src/common/enums';

import { RecruitmentOfferService } from './recruitment-offer.service';

function build(overrides: { affected?: number; offer?: object } = {}) {
  const offer = { id: 'o1', candidateId: 'c1', status: 'SENT', ...overrides.offer };
  const offers = {
    findOne: jest.fn().mockResolvedValue(offer),
    update: jest.fn().mockResolvedValue({ affected: overrides.affected ?? 1 }),
    exists: jest.fn().mockResolvedValue(false),
  };
  const candidates = {
    getCandidate: jest.fn().mockResolvedValue({ id: 'c1', status: CandidateStatus.OFFER }),
    updateCandidateStatus: jest.fn().mockResolvedValue(undefined),
  };
  const mailer = { send: jest.fn().mockResolvedValue({ status: 'sent' }) };
  const service = new RecruitmentOfferService(offers as never, candidates as never, mailer as never);
  return { service, offers, candidates, mailer };
}

describe('RecruitmentOfferService', () => {
  it('claims the offer before touching the candidate, so a second answer is a conflict', async () => {
    const { service, candidates } = build({ affected: 0 });
    await expect(service.respond('t', 'o1', 'm', 'ACCEPTED')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(candidates.updateCandidateStatus).not.toHaveBeenCalled();
  });

  it('puts the offer back to sent when the candidate update fails', async () => {
    const { service, offers, candidates } = build();
    candidates.updateCandidateStatus.mockRejectedValue(new Error('boom'));
    await expect(service.respond('t', 'o1', 'm', 'ACCEPTED')).rejects.toThrow('boom');
    expect(offers.update).toHaveBeenLastCalledWith(
      { id: 'o1', tenantId: 't', status: 'ACCEPTED' },
      { status: 'SENT', respondedAt: null },
    );
  });

  it('does not email twice when a send is raced', async () => {
    const { service, mailer } = build({ affected: 0, offer: { status: 'DRAFT' } });
    await expect(service.send('t', 'o1', 'm', 'tpl')).rejects.toBeInstanceOf(ConflictException);
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('refuses a second open offer for the same candidate', async () => {
    const { service, offers } = build();
    offers.exists.mockResolvedValue(true);
    await expect(
      service.create('t', 'c1', 'm', { amount: 10, currency: 'usd' } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
