import { ConflictException } from '@nestjs/common';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
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

export function assertPayrollRunDeletable(run: PayrollRun): void {
  if (run.status === PayrollStatus.COMPLETED) {
    throw new ConflictException('Completed payroll runs cannot be deleted.');
  }

  const hasPaidOrProcessingItems = (run.items ?? []).some(
    (item) =>
      item.status === PayrollItemStatus.PAID || item.status === PayrollItemStatus.PROCESSING,
  );
  if (hasPaidOrProcessingItems) {
    throw new ConflictException('Payroll runs with paid or in-flight payments cannot be deleted.');
  }
}
