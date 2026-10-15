import { Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  type DemoPayrollEmployee,
  demoPayrollEmployees,
  demoPayrollRun,
} from '../../../constants/landing-demo-data';

type PayrollDemoViewProps = {
  compact?: boolean;
};

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function statusVariant(status: DemoPayrollEmployee['status']) {
  switch (status) {
    case 'paid':
      return 'default' as const;
    case 'processing':
      return 'secondary' as const;
    default:
      return 'outline' as const;
  }
}

function statusLabel(status: DemoPayrollEmployee['status']) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function PayrollDemoView({ compact }: PayrollDemoViewProps) {
  const paidCount = demoPayrollEmployees.filter((e) => e.status === 'paid').length;
  const progress = Math.round((paidCount / demoPayrollEmployees.length) * 100);

  return (
    <div
      className={cn(
        'flex h-full flex-col gap-3 bg-[#fbfdfc] p-4 font-montserrat dark:bg-[#0d1e19]',
        compact && 'p-3',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[#d6e9e1] bg-[#eff9f4] p-4 dark:border-[#2c6352] dark:bg-[#12342a]">
        <div>
          <p className="text-xs font-semibold text-foreground">{demoPayrollRun.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{demoPayrollRun.period}</p>
          <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
            {formatCurrency(demoPayrollRun.totalNet, demoPayrollRun.currency)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{demoPayrollRun.status}</Badge>
          {!compact ? (
            <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled>
              <Download className="mr-1.5 size-3.5" />
              Export bank file
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-[#e2ebe7] bg-white p-3 dark:border-[#25453a] dark:bg-[#132720]">
        <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
          <span>Disbursement progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#e6efeb] dark:bg-[#25453a]">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[#e2ebe7] bg-white dark:border-[#25453a] dark:bg-[#132720]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#edf1ef] bg-[#f7faf8] text-muted-foreground dark:border-[#25453a] dark:bg-[#173128]">
            <tr>
              <th className="px-3 py-2 font-medium">Employee</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">Department</th>
              <th className="px-3 py-2 font-medium">Net pay</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {demoPayrollEmployees.map((employee) => (
              <tr key={employee.id} className="border-b border-border/40 last:border-0">
                <td className="px-3 py-2.5 font-medium text-foreground">{employee.name}</td>
                <td className="hidden px-3 py-2.5 text-muted-foreground sm:table-cell">
                  {employee.department}
                </td>
                <td className="px-3 py-2.5 text-foreground">
                  {formatCurrency(employee.amount, demoPayrollRun.currency)}
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant={statusVariant(employee.status)} className="text-[10px]">
                    {statusLabel(employee.status)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
