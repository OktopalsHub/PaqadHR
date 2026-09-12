'use client';

import { Loader2, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { PersonAvatar } from '@/components/person-avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AppTable,
  AppTableBodyRow,
  AppTableBodySection,
  AppTableCell,
  AppTableEmptyState,
  AppTableHeadCell,
  AppTableHeaderRow,
  AppTableHeaderSection,
} from '@/components/ui/app-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useEmployees } from '@/hooks/queries/use-employees';
import { useAddCompensation, useCurrentSalaries } from '@/hooks/queries/use-employment';
import { useSupportedPaymentCurrencies } from '@/hooks/queries/use-payment-methods';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { numberToWords } from '@/lib/number-to-words';
import { useTenant } from '@/providers/tenant-provider';
import type { Employee } from '../types/';
import { getStatusStyles } from '../utils/';

const PAY_TYPES = ['Salary', 'Hourly', 'Commission', 'Contract'];
const PAY_SCHEDULES = ['Weekly', 'Bi_weekly', 'Monthly', 'Quarterly', 'Annually'];

function formatPaySchedule(schedule: string) {
  return schedule.replaceAll('_', ' ');
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

interface TeamCompensationProps {
  hideAppPage?: boolean;
}

export function TeamCompensation({ hideAppPage = false }: TeamCompensationProps) {
  const { tenant } = useTenant();
  const tenantHref = useTenantHref();
  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';
  const defaultCurrency = tenant?.preferredCurrency ?? 'USD';

  const { data: employees = [], isLoading, isError, error } = useEmployees();
  const { data: currentSalaries = [] } = useCurrentSalaries(isAdmin);

  const [search, setSearch] = useState('');

  const [salaryMember, setSalaryMember] = useState<Employee | null>(null);
  const [effectiveDate, setEffectiveDate] = useState('');
  const [payRate, setPayRate] = useState('');
  const [payType, setPayType] = useState('Salary');
  const [paySchedule, setPaySchedule] = useState('Monthly');
  const [salaryCurrency, setSalaryCurrency] = useState(defaultCurrency);
  const [comments, setComments] = useState('');

  const resetSalaryDialog = () => {
    setEffectiveDate('');
    setPayRate('');
    setPayType('Salary');
    setPaySchedule('Monthly');
    setSalaryCurrency(defaultCurrency);
    setComments('');
  };

  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return employees;
    const term = search.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(term) ||
        emp.email.toLowerCase().includes(term) ||
        emp.department.toLowerCase().includes(term),
    );
  }, [employees, search]);

  const currentSalaryByMemberId = useMemo(
    () => new Map(currentSalaries.map((salary) => [salary.memberId, salary])),
    [currentSalaries],
  );

  const wrap = (children: React.ReactNode) => {
    if (hideAppPage) return <div className="space-y-6">{children}</div>;
    return <AppPage>{children}</AppPage>;
  };

  if (!isAdmin) {
    return wrap(
      <Alert>
        <AlertTitle>Access restricted</AlertTitle>
        <AlertDescription>Only admins and owners can access team salary.</AlertDescription>
      </Alert>,
    );
  }

  if (isLoading) {
    return wrap(<LoadingBlock />);
  }

  if (isError) {
    return wrap(
      <Alert variant="destructive">
        <AlertTitle>Unable to load employees</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Something went wrong'}
        </AlertDescription>
      </Alert>,
    );
  }

  return wrap(
    <>
      <Card className="min-h-[360px] w-full gap-0 overflow-hidden bg-white py-0 dark:bg-card">
        <CardHeader className="!flex flex-col gap-3 border-b border-border/60 bg-muted/15 px-5 py-4 md:flex-row md:items-center md:justify-between sm:px-6">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">Team Salary</CardTitle>
            <p className="text-xs text-muted-foreground">
              {employees.length} {employees.length === 1 ? 'employee' : 'employees'}
            </p>
          </div>
          <div className="relative w-full md:w-[360px] md:max-w-[360px] md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="compensation-search"
              placeholder="Search by name, email, or department…"
              className="app-input-surface h-10 pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <div className="min-h-[280px] flex-1 overflow-x-auto">
            <AppTable className="min-w-[880px]">
              <AppTableHeaderSection>
                <AppTableHeaderRow>
                  <AppTableHeadCell className="w-[31%]">Employee</AppTableHeadCell>
                  <AppTableHeadCell>Department</AppTableHeadCell>
                  <AppTableHeadCell>Current salary</AppTableHeadCell>
                  <AppTableHeadCell>Status</AppTableHeadCell>
                  <AppTableHeadCell className="text-right">Actions</AppTableHeadCell>
                </AppTableHeaderRow>
              </AppTableHeaderSection>
              <AppTableBodySection>
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((employee) => {
                    const currentSalary = currentSalaryByMemberId.get(employee.id);
                    return (
                      <AppTableBodyRow key={employee.id}>
                        <AppTableCell>
                          <Link
                            href={tenantHref(`employees/${employee.id}`)}
                            className="flex min-w-0 items-center gap-3"
                          >
                            <PersonAvatar
                              src={employee.avatar}
                              name={employee.name}
                              className="size-8 border border-border/70 bg-muted"
                              fallbackClassName="bg-muted text-[10px] font-semibold text-foreground"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold hover:underline">
                                {employee.name}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {employee.email}
                              </p>
                            </div>
                          </Link>
                        </AppTableCell>
                        <AppTableCell>
                          {employee.department ? (
                            <div className="flex items-center gap-2">
                              <span
                                className="size-2 shrink-0 rounded-full border border-black/10"
                                style={{ backgroundColor: employee.departmentColor || '#c0cadc' }}
                              />
                              <span>{employee.department}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </AppTableCell>
                        <AppTableCell>
                          {currentSalary ? (
                            <div className="space-y-0.5">
                              <p className="text-sm font-semibold tabular-nums">
                                {formatMoney(
                                  Number(currentSalary.payRate),
                                  currentSalary.currency || defaultCurrency,
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {currentSalary.payType} ·{' '}
                                {formatPaySchedule(currentSalary.paySchedule)} ·{' '}
                                {(currentSalary.currency || defaultCurrency).toUpperCase()}
                              </p>
                            </div>
                          ) : (
                            <span className="inline-flex rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                              No salary set
                            </span>
                          )}
                        </AppTableCell>
                        <AppTableCell>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusStyles(employee.status)}`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                employee.status === 'Active'
                                  ? 'bg-green-500'
                                  : employee.status === 'On Leave'
                                    ? 'bg-amber-500'
                                    : 'bg-gray-450 dark:bg-gray-500'
                              }`}
                            />
                            {employee.status}
                          </span>
                        </AppTableCell>
                        <AppTableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {currentSalary ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 text-xs font-semibold"
                                aria-label={`Update salary for ${employee.name}`}
                                onClick={() => {
                                  const existing = currentSalaryByMemberId.get(employee.id);
                                  setSalaryCurrency(existing?.currency || defaultCurrency);
                                  setSalaryMember(employee);
                                }}
                              >
                                <Plus className="mr-1.5 size-3.5" />
                                Update
                              </Button>
                            ) : (
                              <Button
                                variant="brandSolid"
                                size="sm"
                                className="h-8 px-3 text-xs font-semibold"
                                onClick={() => {
                                  setSalaryCurrency(defaultCurrency);
                                  setSalaryMember(employee);
                                }}
                              >
                                <Plus className="mr-1.5 size-3.5" />
                                Set salary
                              </Button>
                            )}
                          </div>
                        </AppTableCell>
                      </AppTableBodyRow>
                    );
                  })
                ) : (
                  <AppTableEmptyState
                    colSpan={5}
                    title={employees.length === 0 ? 'No employees yet' : 'No matching employees'}
                    description={
                      employees.length === 0
                        ? 'Add employees to your workspace before setting salaries.'
                        : 'Try adjusting your search to find an employee.'
                    }
                  />
                )}
              </AppTableBodySection>
            </AppTable>
          </div>
        </CardContent>
      </Card>

      {}
      {salaryMember ? (
        <SalaryDialog
          memberId={salaryMember.id}
          memberName={salaryMember.name}
          effectiveDate={effectiveDate}
          payRate={payRate}
          payType={payType}
          paySchedule={paySchedule}
          currency={salaryCurrency}
          comments={comments}
          onEffectiveDateChange={setEffectiveDate}
          onPayRateChange={setPayRate}
          onPayTypeChange={setPayType}
          onPayScheduleChange={setPaySchedule}
          onCurrencyChange={setSalaryCurrency}
          onCommentsChange={setComments}
          onClose={() => {
            setSalaryMember(null);
            resetSalaryDialog();
          }}
        />
      ) : null}
    </>,
  );
}

interface SalaryDialogProps {
  memberId: string;
  memberName: string;
  effectiveDate: string;
  payRate: string;
  payType: string;
  paySchedule: string;
  currency: string;
  comments: string;
  onEffectiveDateChange: (value: string) => void;
  onPayRateChange: (value: string) => void;
  onPayTypeChange: (value: string) => void;
  onPayScheduleChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onCommentsChange: (value: string) => void;
  onClose: () => void;
}

function SalaryDialog({
  memberId,
  memberName,
  effectiveDate,
  payRate,
  payType,
  paySchedule,
  currency,
  comments,
  onEffectiveDateChange,
  onPayRateChange,
  onPayTypeChange,
  onPayScheduleChange,
  onCurrencyChange,
  onCommentsChange,
  onClose,
}: SalaryDialogProps) {
  const addCompensation = useAddCompensation(memberId);
  const { data: currencies } = useSupportedPaymentCurrencies();
  const currencyOptions = useMemo(() => {
    const fiat = currencies?.fiat ?? [];
    const crypto = currencies?.crypto ?? [];
    return [...fiat, ...crypto];
  }, [currencies]);

  const handleSubmit = async () => {
    const rate = Number(payRate);
    if (!effectiveDate) {
      toast.error('Enter an effective date');
      return;
    }
    if (!rate || rate <= 0) {
      toast.error('Enter a valid pay rate');
      return;
    }

    try {
      await addCompensation.mutateAsync({
        effectiveDate,
        payRate: rate,
        payType,
        paySchedule,
        currency,
        comments: comments.trim() || undefined,
      });
      toast.success(`Salary added for ${memberName}`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add salary');
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add salary — {memberName}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="comp-effective-date">Effective date</Label>
            <Input
              id="comp-effective-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => onEffectiveDateChange(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="comp-pay-rate">Amount</Label>
              <Input
                id="comp-pay-rate"
                type="number"
                min={0}
                value={payRate}
                onChange={(e) => onPayRateChange(e.target.value)}
              />
              {payRate && Number(payRate) > 0 ? (
                <p className="text-xs text-muted-foreground capitalize">
                  {numberToWords(Number(payRate))}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="comp-currency">Currency</Label>
              <Select value={currency} onValueChange={onCurrencyChange}>
                <SelectTrigger id="comp-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="comp-pay-type">Pay type</Label>
              <Select value={payType} onValueChange={onPayTypeChange}>
                <SelectTrigger id="comp-pay-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="comp-pay-schedule">Pay schedule</Label>
              <Select value={paySchedule} onValueChange={onPayScheduleChange}>
                <SelectTrigger id="comp-pay-schedule">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAY_SCHEDULES.map((schedule) => (
                    <SelectItem key={schedule} value={schedule}>
                      {formatPaySchedule(schedule)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="comp-comments">Note (optional)</Label>
            <Textarea
              id="comp-comments"
              value={comments}
              onChange={(e) => onCommentsChange(e.target.value)}
              placeholder="Annual raise, promotion, etc."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={addCompensation.isPending} onClick={() => void handleSubmit()}>
            {addCompensation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Save salary
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
