"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateLeave, useLeaveBalances } from "@/hooks/queries/use-leaves";
import { toast } from "sonner";

interface LeaveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeaveRequestDialog({
  open,
  onOpenChange,
}: LeaveRequestDialogProps) {
  const createLeave = useCreateLeave();
  const { data: balances = [], isLoading: balancesLoading } = useLeaveBalances();
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!leaveTypeId && balances.length > 0) {
      setLeaveTypeId(balances[0].leaveTypeId);
    }
  }, [balances, leaveTypeId]);

  const handleSubmit = async () => {
    if (!leaveTypeId) {
      toast.error("Select a leave type before submitting.");
      return;
    }

    try {
      await createLeave.mutateAsync({
        leaveTypeId,
        startDate,
        endDate,
        reason,
      });
      toast.success("Leave request submitted");
      onOpenChange(false);
      setStartDate("");
      setEndDate("");
      setReason("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit leave request",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 rounded-lg text-xs">
          <Plus className="mr-1.5 size-3.5" />
          Request leave
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Request Leave</DialogTitle>
          <DialogDescription>
            Fill in the leave request details. Click submit when you&apos;re
            done.
          </DialogDescription>
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
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    balancesLoading
                      ? "Loading leave types..."
                      : balances.length === 0
                        ? "No leave types available"
                        : "Select leave type"
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
              className="min-h-[100px]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
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
