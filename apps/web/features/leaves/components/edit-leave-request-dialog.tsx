'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useLeaveBalances, useUpdateLeave } from '@/hooks/queries/use-leaves';
import type { LeaveRequest } from '@/lib/schemas/leave';

type EditLeaveRequestDialogProps = {
  request: LeaveRequest | null;
  onOpenChange: (open: boolean) => void;
};

export function EditLeaveRequestDialog({ request, onOpenChange }: EditLeaveRequestDialogProps) {
  const updateLeave = useUpdateLeave();
  const { data: balances = [], isLoading: balancesLoading } = useLeaveBalances();
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!request) return;
    setLeaveTypeId(request.leaveTypeId ?? '');
    setStartDate(request.startDate);
    setEndDate(request.endDate);
    setReason(request.reason);
  }, [request]);

  const handleSave = async () => {
    if (!request || !leaveTypeId) {
      toast.error('Select a leave type before saving.');
      return;
    }

    try {
      await updateLeave.mutateAsync({
        leaveId: request.id,
        input: { leaveTypeId, startDate, endDate, reason },
      });
      toast.success('Leave request updated');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update leave request');
    }
  };

  return (
    <Dialog open={Boolean(request)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Leave Request</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="edit-leave-type" className="text-sm font-medium">
              Leave Type
            </label>
            <Select
              value={leaveTypeId}
              onValueChange={setLeaveTypeId}
              disabled={balancesLoading || balances.length === 0}
            >
              <SelectTrigger id="edit-leave-type" className="w-full">
                <SelectValue
                  placeholder={balancesLoading ? 'Loading leave types...' : 'Select leave type'}
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
              <label htmlFor="edit-leave-start-date" className="text-sm font-medium">
                Start Date
              </label>
              <Input
                id="edit-leave-start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="edit-leave-end-date" className="text-sm font-medium">
                End Date
              </label>
              <Input
                id="edit-leave-end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <label htmlFor="edit-leave-reason" className="text-sm font-medium">
              Reason
            </label>
            <Textarea
              id="edit-leave-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateLeave.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={updateLeave.isPending || !leaveTypeId}
          >
            {updateLeave.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
