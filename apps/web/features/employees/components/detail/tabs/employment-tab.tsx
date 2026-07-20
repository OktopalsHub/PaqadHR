'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { SearchSelect } from '@/components/search-select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Separator } from '@/components/ui/separator';
import { TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { memberFullName } from '@/features/employees/lib/employee-detail-state';
import { useDepartments } from '@/hooks/queries/use-departments';
import { useAddCompensation, useEmployments } from '@/hooks/queries/use-employment';
import { useAssignPosition, usePositionHistory, usePositions } from '@/hooks/queries/use-positions';
import { fetchTenantMembers } from '@/lib/api/employees';
import { formatDate } from '@/lib/format-date';
import { numberToWords } from '@/lib/number-to-words';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';
import type { EmployeeDetailForm } from '../../../hooks/use-employee-detail-form';

const PAY_TYPES = ['Salary', 'Hourly', 'Commission', 'Contract'];
const PAY_SCHEDULES = ['Weekly', 'Bi_weekly', 'Monthly', 'Quarterly', 'Annually'];

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatPaySchedule(schedule: string) {
  return schedule.replaceAll('_', ' ');
}

interface EmploymentTabProps {
  form: EmployeeDetailForm;
  memberId: string;
  isAdmin?: boolean;
  canViewCompensation?: boolean;
}

export function EmploymentTab({
  form,
  memberId,
  isAdmin = false,
  canViewCompensation = false,
}: EmploymentTabProps) {
  const { employee, handleInputChange } = form;
  const { tenant, tenantId } = useTenant();
  const currency = tenant?.preferredCurrency ?? 'USD';

  const { data: departments = [], isLoading: departmentsLoading } = useDepartments();
  const { data: tenantMembers = [] } = useQuery({
    queryKey: [...queryKeys.employees.all, tenantId, 'directory'],
    queryFn: fetchTenantMembers,
    enabled: Boolean(tenantId) && isAdmin,
  });

  const managerOptions = useMemo(
    () =>
      tenantMembers
        .filter((member) => member.id !== memberId && member.isActive)
        .map((member) => ({
          value: member.id,
          label: memberFullName(member) || member.preferredName || 'Member',
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [memberId, tenantMembers],
  );

  const departmentOptions = useMemo(
    () => departments.map((dept) => ({ value: dept.id, label: dept.name })),
    [departments],
  );

  const noneManagerOption = { value: '', label: 'No manager' };
  const noneDepartmentOption = { value: '', label: 'No department' };

  const {
    data: positionHistory = [],
    isLoading: positionHistoryLoading,
    isError: positionHistoryError,
    error: positionHistoryLoadError,
  } = usePositionHistory(memberId);
  const { data: positions = [], isLoading: positionsLoading } = usePositions();
  const assignPosition = useAssignPosition(memberId);

  const {
    data: employments = [],
    isLoading,
    isError,
    error,
  } = useEmployments(memberId, canViewCompensation);
  const addCompensation = useAddCompensation(memberId);

  const salaryHistory = useMemo(
    () =>
      [...employments].sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
      ),
    [employments],
  );

  const displayValue = (value: string) => value || '—';

  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState('');
  const [payRate, setPayRate] = useState('');
  const [payType, setPayType] = useState('Salary');
  const [paySchedule, setPaySchedule] = useState('Monthly');
  const [comments, setComments] = useState('');

  const [positionDialogOpen, setPositionDialogOpen] = useState(false);
  const [positionEffectiveDate, setPositionEffectiveDate] = useState('');
  const [positionId, setPositionId] = useState('');

  const resetSalaryDialog = () => {
    setEffectiveDate('');
    setPayRate('');
    setPayType('Salary');
    setPaySchedule('Monthly');
    setComments('');
  };

  const resetPositionDialog = () => {
    setPositionEffectiveDate('');
    setPositionId('');
  };

  const handleAddSalary = async () => {
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
      toast.success('Salary added');
      setSalaryDialogOpen(false);
      resetSalaryDialog();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add salary');
    }
  };

  const handleAssignPosition = async () => {
    if (!positionId) {
      toast.error('Select a position');
      return;
    }
    if (!positionEffectiveDate) {
      toast.error('Enter an effective date');
      return;
    }

    try {
      await assignPosition.mutateAsync({
        positionId,
        assignedAt: positionEffectiveDate,
      });
      toast.success('Position updated');
      setPositionDialogOpen(false);
      resetPositionDialog();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update position');
    }
  };

  return (
    <TabsContent value="employment">
      <Card>
        <CardHeader>
          <CardTitle>Employment Details</CardTitle>
          <CardDescription>Job information and employment history</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employee-id">Employee ID</Label>
              <Input
                id="employee-id"
                value={displayValue(employee.employment.employeeId)}
                readOnly
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-title">Current job title</Label>
              <Input
                id="job-title"
                value={displayValue(employee.position)}
                readOnly
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Current department</Label>
              {isAdmin ? (
                <SearchSelect
                  options={[noneDepartmentOption, ...departmentOptions]}
                  value={employee.departmentId}
                  onValueChange={(value) => {
                    const department = departmentOptions.find((dept) => dept.value === value);
                    handleInputChange('departmentId', value);
                    handleInputChange('department', department?.label ?? '');
                  }}
                  placeholder="Select department"
                  searchPlaceholder="Search departments…"
                  emptyMessage="No departments found."
                  disabled={departmentsLoading}
                />
              ) : (
                <Input
                  id="department"
                  value={displayValue(employee.department)}
                  readOnly
                  className="bg-muted/50"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="manager">Reports to</Label>
              {isAdmin ? (
                <SearchSelect
                  options={[noneManagerOption, ...managerOptions]}
                  value={employee.reportsToId}
                  onValueChange={(value) => {
                    const manager = managerOptions.find((member) => member.value === value);
                    handleInputChange('reportsToId', value);
                    handleInputChange('manager', manager?.label ?? '');
                  }}
                  placeholder="Select manager"
                  searchPlaceholder="Search people…"
                  emptyMessage="No people found."
                />
              ) : (
                <Input
                  id="manager"
                  value={displayValue(employee.manager)}
                  readOnly
                  className="bg-muted/50"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="join-date">Join Date</Label>
              <Input
                id="join-date"
                type="date"
                value={employee.hireDate || employee.employment.joinDate || ''}
                readOnly
                className="bg-muted/50"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-medium">Position history</h4>
                <p className="text-sm text-muted-foreground">
                  Role changes over time, separate from salary.
                </p>
              </div>
              {isAdmin ? (
                <Dialog
                  open={positionDialogOpen}
                  onOpenChange={(open) => {
                    setPositionDialogOpen(open);
                    if (!open) resetPositionDialog();
                  }}
                >
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Plus className="mr-2 size-4" />
                      Change position
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                      <DialogTitle>Change position</DialogTitle>
                      <DialogDescription>
                        Record a new role for this employee. Previous positions stay in history.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                      {positionsLoading ? (
                        <p className="text-sm text-muted-foreground">Loading positions…</p>
                      ) : positions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No positions found. Create positions in your workspace first.
                        </p>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="assign-position">Position</Label>
                            <Select value={positionId} onValueChange={setPositionId}>
                              <SelectTrigger id="assign-position">
                                <SelectValue placeholder="Select position" />
                              </SelectTrigger>
                              <SelectContent>
                                {positions.map((position) => (
                                  <SelectItem key={position.id} value={position.id}>
                                    {position.title}
                                    {position.department ? ` · ${position.department}` : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="position-effective-date">Effective date</Label>
                            <Input
                              id="position-effective-date"
                              type="date"
                              value={positionEffectiveDate}
                              onChange={(e) => setPositionEffectiveDate(e.target.value)}
                            />
                          </div>
                        </>
                      )}
                    </div>
                    <DialogFooter>
                      <Button
                        disabled={
                          assignPosition.isPending || positionsLoading || positions.length === 0
                        }
                        onClick={() => void handleAssignPosition()}
                      >
                        {assignPosition.isPending ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : null}
                        Save position
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ) : null}
            </div>

            {positionHistoryError ? (
              <p className="text-sm text-muted-foreground">
                {positionHistoryLoadError instanceof Error
                  ? positionHistoryLoadError.message
                  : 'Unable to load position history.'}
              </p>
            ) : positionHistoryLoading ? (
              <p className="text-sm text-muted-foreground">Loading position history…</p>
            ) : positionHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {isAdmin
                  ? 'No position on file yet. Assign the first role for this employee.'
                  : 'No position history on file yet.'}
              </p>
            ) : (
              <div className="rounded-lg border border-border/60">
                <div className="hidden grid-cols-[1.2fr_1fr_1fr_0.7fr] gap-3 border-b border-border/60 px-4 py-3 text-xs font-medium text-muted-foreground md:grid">
                  <span>Effective date</span>
                  <span>Title</span>
                  <span>Department</span>
                  <span>Status</span>
                </div>
                <div className="divide-y divide-border/60">
                  {positionHistory.map((record) => (
                    <div
                      key={record.id}
                      className="flex flex-col gap-2 px-4 py-3 text-sm md:grid md:grid-cols-[1.2fr_1fr_1fr_0.7fr] md:items-center md:gap-3"
                    >
                      <p className="font-medium">{formatDate(record.assignedAt)}</p>
                      <p className="font-medium">{displayValue(record.position?.title ?? '')}</p>
                      <p>{displayValue(record.position?.department ?? '')}</p>
                      <div>
                        <Badge variant={record.isCurrent ? 'secondary' : 'outline'}>
                          {record.isCurrent ? 'Current' : 'Ended'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {canViewCompensation ? (
            <>
              <Separator />

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="font-medium">Compensation</h4>
                    <p className="text-sm text-muted-foreground">
                      Salary history with the latest amount on top.
                    </p>
                  </div>
                  {isAdmin ? (
                    <Dialog
                      open={salaryDialogOpen}
                      onOpenChange={(open) => {
                        setSalaryDialogOpen(open);
                        if (!open) resetSalaryDialog();
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="mr-2 size-4" />
                          Add salary
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[480px]">
                        <DialogHeader>
                          <DialogTitle>Add salary</DialogTitle>
                          <DialogDescription>
                            Record a new salary amount. Previous salaries stay in history.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-2">
                          <div className="space-y-2">
                            <Label htmlFor="effective-date">Effective date</Label>
                            <Input
                              id="effective-date"
                              type="date"
                              value={effectiveDate}
                              onChange={(e) => setEffectiveDate(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="add-pay-rate">Amount</Label>
                            <Input
                              id="add-pay-rate"
                              type="number"
                              min={0}
                              value={payRate}
                              onChange={(e) => setPayRate(e.target.value)}
                            />
                            {payRate && Number(payRate) > 0 ? (
                              <p className="text-xs text-muted-foreground capitalize">
                                {numberToWords(Number(payRate))}
                              </p>
                            ) : null}
                          </div>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="add-pay-type">Pay type</Label>
                              <Select value={payType} onValueChange={setPayType}>
                                <SelectTrigger id="add-pay-type">
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
                              <Label htmlFor="add-pay-schedule">Pay schedule</Label>
                              <Select value={paySchedule} onValueChange={setPaySchedule}>
                                <SelectTrigger id="add-pay-schedule">
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
                            <Label htmlFor="salary-comments">Note (optional)</Label>
                            <Textarea
                              id="salary-comments"
                              value={comments}
                              onChange={(e) => setComments(e.target.value)}
                              placeholder="Annual raise, promotion, etc."
                              rows={3}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            disabled={addCompensation.isPending}
                            onClick={() => void handleAddSalary()}
                          >
                            {addCompensation.isPending ? (
                              <Loader2 className="mr-2 size-4 animate-spin" />
                            ) : null}
                            Save salary
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  ) : null}
                </div>

                {isError ? (
                  <p className="text-sm text-muted-foreground">
                    {error instanceof Error ? error.message : 'Unable to load salary history.'}
                  </p>
                ) : isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading salary history…</p>
                ) : salaryHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {isAdmin
                      ? 'No salary on file yet. Add the first salary to enable payroll.'
                      : 'No salary on file yet. Contact your admin.'}
                  </p>
                ) : (
                  <div className="rounded-lg border border-border/60">
                    <div className="hidden grid-cols-[1.2fr_1fr_0.9fr_0.9fr_0.7fr] gap-3 border-b border-border/60 px-4 py-3 text-xs font-medium text-muted-foreground md:grid">
                      <span>Effective date</span>
                      <span>Amount</span>
                      <span>Pay type</span>
                      <span>Schedule</span>
                      <span>Status</span>
                    </div>
                    <div className="divide-y divide-border/60">
                      {salaryHistory.map((record) => {
                        const amount = Number(record.payRate);
                        const isCurrent = !record.endDate;
                        return (
                          <div
                            key={record.id}
                            className="flex flex-col gap-2 px-4 py-3 text-sm md:grid md:grid-cols-[1.2fr_1fr_0.9fr_0.9fr_0.7fr] md:items-center md:gap-3"
                          >
                            <div>
                              <p className="font-medium">{formatDate(record.startDate)}</p>
                              {record.comments ? (
                                <p className="text-xs text-muted-foreground">{record.comments}</p>
                              ) : null}
                            </div>
                            <p className="font-medium">
                              {Number.isFinite(amount)
                                ? formatMoney(amount, currency)
                                : displayValue(String(record.payRate))}
                            </p>
                            <p className="capitalize">{record.payType}</p>
                            <p className="capitalize">{formatPaySchedule(record.paySchedule)}</p>
                            <div>
                              <Badge variant={isCurrent ? 'secondary' : 'outline'}>
                                {isCurrent ? 'Current' : 'Ended'}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
