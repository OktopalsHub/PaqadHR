import type { PaymentMethod } from '../entities/payment-method.entity';
import { PmCreationService } from './pm-creation.service';

type Switcher = { saveSwitchingPrimary(pm: PaymentMethod, makePrimary: boolean): Promise<unknown> };

function build() {
  const txRepo = {
    update: jest.fn().mockResolvedValue(undefined),
    save: jest.fn(async (pm) => pm),
  };
  const repo = {
    save: jest.fn(async (pm) => pm),
    manager: {
      transaction: jest.fn(async (cb: (m: unknown) => unknown) =>
        cb({ getRepository: () => txRepo }),
      ),
    },
  };
  const service = Object.create(PmCreationService.prototype) as Switcher & { repo: unknown };
  service.repo = repo;
  return { service, repo, txRepo };
}

describe('PmCreationService primary switch', () => {
  const pm = { id: 'new', tenantId: 't', memberId: 'm', isPrimary: true } as PaymentMethod;

  it('demotes the other primaries and saves in one transaction', async () => {
    const { service, repo, txRepo } = build();
    await service.saveSwitchingPrimary(pm, true);
    expect(repo.manager.transaction).toHaveBeenCalledTimes(1);
    expect(txRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't', memberId: 'm', isPrimary: true }),
      { isPrimary: false },
    );
    expect(txRepo.save).toHaveBeenCalledWith(pm);
  });

  it('does not touch other methods when not becoming primary', async () => {
    const { service, repo, txRepo } = build();
    await service.saveSwitchingPrimary(pm, false);
    expect(repo.save).toHaveBeenCalledWith(pm);
    expect(txRepo.update).not.toHaveBeenCalled();
  });
});
