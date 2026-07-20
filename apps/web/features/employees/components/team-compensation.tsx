'use client';

import { Loader2, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { PersonAvatar } from '@/components/person-avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useEmployees } from '@/hooks/queries/use-employees';
import { useAddCompensation, useCurrentSalaries } from '@/hooks/queries/use-employment';
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
  const currency = (tenant as { preferredCurrency?: string } | null)?.preferredCurrency ?? 'USD';

  const { data: employees = [], isLoading, isError, error } = useEmployees();
  const { data: currentSalaries = [] } = useCurrentSalaries(isAdmin);

  const [search, setSearch] = useState('');

  const [salaryMember, setSalaryMember] = useState<Employee | null>(null);
  const [effectiveDate, setEffectiveDate] = useState('');
  const [payRate, setPayRate] = useState('');
  const [payType, setPayType] = useState('Salary');
  const [paySchedule, setPaySchedule] = useState('Monthly');
  const [comments, setComments] = useState('');

  const resetSalaryDialog = () => {
    setEffectiveDate('');
    setPayRate('');
    setPayType('Salary');
    setPaySchedule('Monthly');
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
      <Card>
        <CardHeader className="!flex flex-col gap-4 border-b border-[#d7e3f6] md:flex-row md:items-end md:justify-between dark:border-slate-800">
          <div className="min-w-0 space-y-1">
            <CardTitle>Team Salary</CardTitle>
            <CardDescription>Manage salary for all team members in one place.</CardDescription>
          </div>
          <div className="relative w-full md:w-[420px] md:max-w-[420px] md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="compensation-search"
              placeholder="Search by name, email, or department…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredEmployees.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              {employees.length === 0
                ? 'No employees in your workspace yet.'
                : 'No employees match your search.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Current salary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => {
                    const currentSalary = currentSalaryByMemberId.get(employee.id);
                    return (
                      <TableRow key={employee.id}>
                        <TableCell>
                          <Link
                            href={tenantHref(`employees/${employee.id}`)}
                            className="flex items-center gap-2 hover:underline"
                          >
                            <PersonAvatar
                              src={employee.avatar}
                              name={employee.name}
                              className="h-8 w-8"
                            />
                            <div>
                              <p className="font-medium text-sm">{employee.name}</p>
                              <p className="text-xs text-muted-foreground">{employee.email}</p>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>{employee.department || '—'}</TableCell>
                        <TableCell>
                          {currentSalary ? (
                            <div className="space-y-0.5">
                              <p className="font-medium text-sm">
                                {formatMoney(Number(currentSalary.payRate), currency)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {currentSalary.payType} ·{' '}
                                {formatPaySchedule(currentSalary.paySchedule)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">No salary added</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusStyles(employee.status)}`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                employee.status === 'Active'
                                  ? 'bg-green-500 animate-pulse'
                                  : employee.status === 'On Leave'
                                    ? 'bg-amber-500'
                                    : 'bg-gray-450 dark:bg-gray-500'
                              }`}
                            />
                            {employee.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {currentSalary ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                title={`Add new salary for ${employee.name}`}
                                aria-label={`Add new salary for ${employee.name}`}
                                onClick={() => setSalaryMember(employee)}
                              >
                                <Plus className="size-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSalaryMember(employee)}
                              >
                                <Plus className="mr-1.5 size-3.5" />
                                Salary
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
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
          comments={comments}
          onEffectiveDateChange={setEffectiveDate}
          onPayRateChange={setPayRate}
          onPayTypeChange={setPayType}
          onPayScheduleChange={setPaySchedule}
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
  comments: string;
  onEffectiveDateChange: (value: string) => void;
  onPayRateChange: (value: string) => void;
  onPayTypeChange: (value: string) => void;
  onPayScheduleChange: (value: string) => void;
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
  comments,
  onEffectiveDateChange,
  onPayRateChange,
  onPayTypeChange,
  onPayScheduleChange,
  onCommentsChange,
  onClose,
}: SalaryDialogProps) {
  const addCompensation = useAddCompensation(memberId);

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
          <DialogDescription>
            Record a new salary amount. Previous salaries stay in history.
          </DialogDescription>
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
