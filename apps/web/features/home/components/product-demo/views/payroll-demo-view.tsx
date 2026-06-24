import { Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  demoPayrollEmployees,
  demoPayrollRun,
  type DemoPayrollEmployee,
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
    <div className={cn('space-y-4 p-4', compact && 'p-3')}>
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{demoPayrollRun.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{demoPayrollRun.period}</p>
          <p className="mt-2 text-lg font-semibold text-foreground">
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

      <div>
        <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
          <span>Disbursement progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border/60 bg-muted/30 text-muted-foreground">
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
