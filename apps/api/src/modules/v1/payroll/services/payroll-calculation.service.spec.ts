import { ConflictException } from '@nestjs/common';

import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import { PayrollCalculationService } from './payroll-calculation.service';

function build(status: PayrollStatus) {
  const runRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 'run-1', tenantId: 't-1', status, items: [] }),
    save: jest.fn(),
  };
  const itemRepo = { save: jest.fn() };
  const service = new PayrollCalculationService(
    runRepo as never,
    itemRepo as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, runRepo, itemRepo };
}

describe('PayrollCalculationService', () => {
  it('constructs with its DI dependencies', () => {
    const service = new PayrollCalculationService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    expect(service).toBeInstanceOf(PayrollCalculationService);
  });

  describe('calculatePayroll status guard', () => {
    const blocked = Object.values(PayrollStatus).filter((s) => s !== PayrollStatus.DRAFT);

    it.each(blocked)('refuses to recalculate a %s run and writes nothing', async (status) => {
      const { service, runRepo, itemRepo } = build(status);

      await expect(service.calculatePayroll('run-1', 't-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(runRepo.save).not.toHaveBeenCalled();
      expect(itemRepo.save).not.toHaveBeenCalled();
    });

    it('lets a draft run past the status guard', async () => {
      const { service } = build(PayrollStatus.DRAFT);

      await expect(service.calculatePayroll('run-1', 't-1')).rejects.not.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
