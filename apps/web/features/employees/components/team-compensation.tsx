'use client';

import { Loader2, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { useAddCompensation } from '@/hooks/queries/use-employment';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { numberToWords } from '@/lib/number-to-words';
import { getInitials } from '@/lib/utils';
import { useTenant } from '@/providers/tenant-provider';
import type { Employee } from '../types/';
import { getStatusStyles } from '../utils/';

const PAY_TYPES = ['Salary', 'Hourly', 'Commission', 'Contract'];
const PAY_SCHEDULES = ['Weekly', 'Bi_weekly', 'Monthly', 'Quarterly', 'Annually'];

function formatPaySchedule(schedule: string) {
  return schedule.replaceAll('_', ' ');
}

interface TeamCompensationProps {
  hideAppPage?: boolean;
}

export function TeamCompensation({ hideAppPage = false }: TeamCompensationProps) {
  const { tenant } = useTenant();
  const tenantHref = useTenantHref();
  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';

  const { data: employees = [], isLoading, isError, error } = useEmployees();

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
        <CardHeader>
          <CardTitle>Team Salary</CardTitle>
          <CardDescription>Manage salary for all team members in one place.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="compensation-search"
              placeholder="Search by name, email, or department…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filteredEmployees.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {employees.length === 0
                ? 'No employees in your workspace yet.'
                : 'No employees match your search.'}
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <Link
                          href={tenantHref(`employees/${employee.id}`)}
                          className="flex items-center gap-2 hover:underline"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={employee.avatar || '/placeholder.svg'} />
                            <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{employee.name}</p>
                            <p className="text-xs text-muted-foreground">{employee.email}</p>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>{employee.department || '—'}</TableCell>
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSalaryMember(employee)}
                          >
                            <Plus className="mr-1.5 size-3.5" />
                            Salary
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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
