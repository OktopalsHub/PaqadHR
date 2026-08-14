'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiClient, tenantPath } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

interface Member {
  id: string;
  name: string;
  email: string;
}

export function AttendanceManualEntryDialog({ members }: { members: Member[] }) {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [status, setStatus] = useState('PRESENT');
  const [notes, setNotes] = useState('');
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async () => {
    if (!selectedMemberId || !date || !status) {
      toast.error('Fill in required fields');
      return;
    }
    setIsPending(true);
    try {
      await apiClient(tenantPath(tenantId!, 'attendance/manual'), {
        method: 'POST',
        body: JSON.stringify({
          tenantMemberId: selectedMemberId,
          date: new Date(date).toISOString(),
          clockIn: clockIn ? new Date(`${date}T${clockIn}`).toISOString() : undefined,
          clockOut: clockOut ? new Date(`${date}T${clockOut}`).toISOString() : undefined,
          status,
          notes: notes.trim() || undefined,
        }),
      });
      toast.success('Attendance recorded');
      setOpen(false);
      setSelectedMemberId('');
      setClockIn('');
      setClockOut('');
      setNotes('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.myRecords });
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.teamRecords });
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.monthly });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record attendance');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Manual Entry
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manual Attendance Entry</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Employee</Label>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            >
              <option value="">Select employee</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="manual-date">Date</Label>
            <Input
              id="manual-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="manual-clock-in">Clock In</Label>
              <Input
                id="manual-clock-in"
                type="time"
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manual-clock-out">Clock Out</Label>
              <Input
                id="manual-clock-out"
                type="time"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            >
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LATE">Late</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="ON_LEAVE">On Leave</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="manual-notes">Notes</Label>
            <Textarea
              id="manual-notes"
              placeholder="Optional notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
