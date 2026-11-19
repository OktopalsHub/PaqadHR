import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';

import { isSafeEmailHtml } from './recruitment-ai.schemas';
import { RecruitmentAiService } from './recruitment-ai.service';

class TestableAi extends RecruitmentAiService {
  next: unknown;
  protected override async generate(): Promise<never> {
    return this.next as never;
  }
}

describe('RecruitmentAiService', () => {
  const build = () =>
    new TestableAi(
      {
        findOne: jest.fn().mockResolvedValue({ id: 'c1', jobOpeningId: 'j1', skills: 'ts' }),
        update: jest.fn().mockResolvedValue(undefined),
      } as never,
      { findOne: jest.fn().mockResolvedValue({ title: 'Eng', requirements: [] }) } as never,
    );

  it('stores the screening result on the candidate', async () => {
    const ai = build();
    ai.next = { score: 80, recommendation: 'advance', summary: 's', strengths: [], gaps: [] };
    await ai.screenCandidate('t1', 'c1');
    const update = (ai as unknown as { candidates: { update: jest.Mock } }).candidates.update;
    expect(update).toHaveBeenCalledWith(
      { id: 'c1', tenantId: 't1' },
      { aiScreening: expect.objectContaining({ score: 80 }) },
    );
  });

  it('discards drafts with unsafe markup', async () => {
    const ai = build();
    ai.next = { subject: 'Hi', bodyHtml: '<p onclick="x()">Hi</p>' };
    await expect(ai.draftEmail({ purpose: 'x', tone: 'warm' })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('flags unsafe html', () => {
    expect(isSafeEmailHtml('<p>Hello</p>')).toBe(true);
    expect(isSafeEmailHtml('<script>alert(1)</script>')).toBe(false);
    expect(isSafeEmailHtml('<a href="javascript:x">y</a>')).toBe(false);
  });

  it('reports AI as unavailable without an API key', async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const real = new (class extends RecruitmentAiService {})({} as never, {} as never);
    await expect(real.draftJob({ title: 'Eng' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    if (saved) process.env.ANTHROPIC_API_KEY = saved;
  });
});
