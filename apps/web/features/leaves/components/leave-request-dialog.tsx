'use client';

import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateLeave, useLeaveBalances } from '@/hooks/queries/use-leaves';

interface LeaveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeaveRequestDialog({ open, onOpenChange }: LeaveRequestDialogProps) {
  const createLeave = useCreateLeave();
  const { data: balances = [], isLoading: balancesLoading } = useLeaveBalances();
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!leaveTypeId && balances.length > 0) {
      setLeaveTypeId(balances[0].leaveTypeId);
    }
  }, [balances, leaveTypeId]);

  const handleSubmit = async () => {
    if (!leaveTypeId) {
      toast.error('Select a leave type before submitting.');
      return;
    }

    try {
      await createLeave.mutateAsync({
        leaveTypeId,
        startDate,
        endDate,
        reason,
      });
      toast.success('Leave request submitted');
      onOpenChange(false);
      setStartDate('');
      setEndDate('');
      setReason('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit leave request');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="brandSolid" size="app" className="w-max">
          <Plus className="size-4" />
          Request leave
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Request Leave</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="leaveType" className="text-sm font-medium">
              Leave Type
            </label>
            <Select
              value={leaveTypeId}
              onValueChange={setLeaveTypeId}
              disabled={balancesLoading || balances.length === 0}
            >
              <SelectTrigger className="w-full border-slate-200 bg-white text-slate-700 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100">
                <SelectValue
                  placeholder={
                    balancesLoading
                      ? 'Loading leave types...'
                      : balances.length === 0
                        ? 'No leave types available'
                        : 'Select leave type'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {balances.map((balance) => (
                  <SelectItem key={balance.leaveTypeId} value={balance.leaveTypeId}>
                    {balance.leaveTypeName} ({balance.remaining} days left)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label htmlFor="start-date" className="text-sm font-medium">
                Start Date
              </label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border-slate-200 bg-white text-slate-700 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="end-date" className="text-sm font-medium">
                End Date
              </label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border-slate-200 bg-white text-slate-700 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <label htmlFor="reason" className="text-sm font-medium">
              Reason
            </label>
            <Textarea
              id="reason"
              placeholder="Briefly describe the reason for your leave"
              className="min-h-[100px] rounded-[8px] border-slate-200 bg-white text-slate-700 shadow-none placeholder:text-slate-400 focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={createLeave.isPending || !leaveTypeId}
          >
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
