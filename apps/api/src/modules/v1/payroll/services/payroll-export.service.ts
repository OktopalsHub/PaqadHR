import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethodService } from '../../payment-method/services/payment-method.service';
import type { PayrollItem } from '../entities/payroll-item.entity';
import type { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';

export interface PayrollBankExportRow {
  employeeId: string;
  employeeName: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  amount: number;
  currency: string;
  reference: string;
}

@Injectable()
export class PayrollExportService {
  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly paymentMethodService: PaymentMethodService,
  ) {}

  async getPayrollRunForExport(payrollRunId: string, tenantId: string): Promise<PayrollRun> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: ['items', 'items.employee'],
    });
    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }
    return run;
  }

  async buildBankExportRows(payrollRun: PayrollRun): Promise<PayrollBankExportRow[]> {
    const rows: PayrollBankExportRow[] = [];

    for (const item of payrollRun.items ?? []) {
      const paymentMethod = await this.paymentMethodService.findByMemberId(item.memberId);
      const employee = item.employee;
      const name = employee
        ? `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim()
        : item.memberId;

      rows.push({
        employeeId: item.memberId,
        employeeName: name || 'Unknown',
        accountName: paymentMethod?.accountName ?? '',
        accountNumber: paymentMethod?.accountNumber ?? '',
        bankName: paymentMethod?.bankName ?? '',
        bankCode: paymentMethod?.bankCode ?? '',
        amount: Number(item.paymentAmount ?? item.netAmount ?? 0),
        currency: item.paymentCurrency ?? payrollRun.baseCurrency,
        reference: `PAYROLL-${payrollRun.id.slice(0, 8)}-${item.memberId.slice(0, 8)}`,
      });
    }

    return rows;
  }

  toCsv(rows: PayrollBankExportRow[], payrollRun: PayrollRun): string {
    const header = [
      'employee_id',
      'employee_name',
      'account_name',
      'account_number',
      'bank_name',
      'bank_code',
      'amount',
      'currency',
      'reference',
      'payroll_run_id',
      'period_start',
      'period_end',
    ];

    const escapeCsv = (value: string | number | Date) => {
      const str = value instanceof Date ? value.toISOString() : String(value ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines = [
      header.join(','),
      ...rows.map((row) =>
        [
          row.employeeId,
          row.employeeName,
          row.accountName,
          row.accountNumber,
          row.bankName,
          row.bankCode,
          row.amount.toFixed(2),
          row.currency,
          row.reference,
          payrollRun.id,
          payrollRun.periodStart,
          payrollRun.periodEnd,
        ]
          .map(escapeCsv)
          .join(','),
      ),
    ];

    return lines.join('\n');
  }

  renderPayslipHtml(payrollRun: PayrollRun, item: PayrollItem): string {
    const employee = item.employee;
    const employeeName = employee
      ? `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim()
      : item.memberId;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Payslip — ${employeeName}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #111; }
    h1 { font-size: 1.25rem; margin-bottom: 0.25rem; }
    .muted { color: #666; font-size: 0.9rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1.5rem; }
    th, td { text-align: left; padding: 0.5rem 0; border-bottom: 1px solid #eee; }
    th { width: 40%; color: #444; font-weight: 600; }
    .total td { font-weight: 700; border-top: 2px solid #111; }
  </style>
</head>
<body>
  <h1>Payslip</h1>
  <p class="muted">${payrollRun.title}</p>
  <p class="muted">Period: ${payrollRun.periodStart} — ${payrollRun.periodEnd}</p>
  <p><strong>Employee:</strong> ${employeeName}</p>
  <table>
    <tr><th>Base salary</th><td>${item.baseSalary} ${item.baseSalaryCurrency}</td></tr>
    <tr><th>Gross</th><td>${item.grossAmount} ${payrollRun.baseCurrency}</td></tr>
    <tr><th>Adjustments</th><td>${item.adjustments}</td></tr>
    <tr><th>Deductions</th><td>${item.deductions}</td></tr>
    <tr class="total"><th>Net pay</th><td>${item.netAmount} ${payrollRun.baseCurrency}</td></tr>
    <tr><th>Payment amount</th><td>${item.paymentAmount} ${item.paymentCurrency}</td></tr>
    <tr><th>Status</th><td>${item.status}</td></tr>
    ${item.paidAt ? `<tr><th>Paid at</th><td>${item.paidAt}</td></tr>` : ''}
  </table>
  ${item.description ? `<p class="muted">${item.description}</p>` : ''}
</body>
</html>`;
  }
}
