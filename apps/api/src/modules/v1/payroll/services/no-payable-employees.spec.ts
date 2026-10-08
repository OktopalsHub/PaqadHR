import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import type { PayrollItem } from '../entities/payroll-item.entity';
import { noPayableEmployeesMessage } from './multi-payment.service';

const item = (status: PayrollItemStatus): PayrollItem => ({ status }) as PayrollItem;

// A run whose items are already paid or in flight is not a payment-method or funding
// problem. Reporting it as one sent admins chasing settings that were already correct.
describe('noPayableEmployeesMessage', () => {
  it('says every employee is already paid when all items are paid', () => {
    const message = noPayableEmployeesMessage(
      [item(PayrollItemStatus.PAID), item(PayrollItemStatus.PAID)],
      'then use Retry payment.',
    );
    expect(message).toBe('Every employee on this run has already been paid.');
    expect(message).not.toMatch(/payment method/);
  });

  it('says payout is in progress when every item is processing', () => {
    const message = noPayableEmployeesMessage(
      [item(PayrollItemStatus.PROCESSING)],
      'then use Retry payment.',
    );
    expect(message).toMatch(/already in progress/);
    expect(message).not.toMatch(/payment method/);
  });

  it('keeps the payment-method guidance when items were not ready', () => {
    const message = noPayableEmployeesMessage(
      [item(PayrollItemStatus.FAILED)],
      'then use Retry payment.',
    );
    expect(message).toMatch(/No employees could be paid/);
    expect(message).toMatch(/payment method/);
  });

  it('reports nothing to pay when every item was cancelled', () => {
    const message = noPayableEmployeesMessage(
      [item(PayrollItemStatus.CANCELLED)],
      'then retry again.',
    );
    expect(message).toBe('Every employee on this run was cancelled, so there is nothing to pay.');
  });
});
