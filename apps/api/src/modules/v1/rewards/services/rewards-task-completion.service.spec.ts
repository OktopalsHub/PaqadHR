import { BadRequestException } from '@nestjs/common';

import { RewardsTaskCompletionService } from './rewards-task-completion.service';

describe('RewardsTaskCompletionService.approveSubmission', () => {
  const sub = { id: 's1', memberId: 'worker', status: 'pending' };
  const task = { id: 'task', points: 10, title: 'Read policy' };

  function build(affected: number) {
    const award = jest.fn();
    const update = jest.fn().mockResolvedValue({ affected });
    const manager = {
      query: jest.fn(),
      getRepository: () => ({ update }),
    };
    const dataSource = {
      transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
      getRepository: (entity: { name: string }) => ({
        findOne: jest.fn().mockResolvedValue(entity.name === 'Task' ? task : sub),
      }),
    };
    const service = new RewardsTaskCompletionService(dataSource as never, {
      sendTaskCompletionPointsNotification: jest.fn().mockResolvedValue(undefined),
    } as never);
    Object.assign(service, {
      canActorApproveFor: jest.fn().mockResolvedValue(true),
      creditTaskPoints: award,
    });
    return { service, award, manager };
  }

  it('awards points once the submission is claimed', async () => {
    const { service, award } = build(1);
    await service.approveSubmission('t', 'task', 's1', 'boss');
    expect(award).toHaveBeenCalledTimes(1);
  });

  it('awards nothing when a second approval loses the claim', async () => {
    const { service, award } = build(0);
    await expect(service.approveSubmission('t', 'task', 's1', 'boss')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(award).not.toHaveBeenCalled();
  });
});
