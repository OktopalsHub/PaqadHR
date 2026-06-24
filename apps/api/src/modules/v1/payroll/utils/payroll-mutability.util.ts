import { ConflictException } from '@nestjs/common';
import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import type { PayrollRun } from '../entities/payroll-run.entity';

export type PayrollMutabilityMode = 'edit' | 'remove' | 'recalculate';

export function assertPayrollRunMutable(run: PayrollRun, mode: PayrollMutabilityMode): void {
  if (mode === 'edit' || mode === 'recalculate') {
    if (run.status !== PayrollStatus.DRAFT) {
      throw new ConflictException(
        `Payroll run cannot be modified in ${run.status} status. Only draft runs can be edited.`,
      );
    }
    return;
  }

  if (mode === 'remove') {
    if (run.status !== PayrollStatus.DRAFT && run.status !== PayrollStatus.PROCESSING) {
      throw new ConflictException(
        `Employees cannot be removed from a payroll run in ${run.status} status.`,
      );
    }
  }
}
