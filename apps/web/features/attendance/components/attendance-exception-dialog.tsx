'use client';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateAttendanceException } from '@/hooks/queries/use-attendance';

const EXCEPTION_TYPES = [
  { value: 'OVERTIME', label: 'Overtime' },
  { value: 'UNDERTIME', label: 'Undertime' },
  { value: 'ABSENCE', label: 'Absence' },
  { value: 'LATE', label: 'Late' },
] as const;

export function AttendanceExceptionDialog() {
  const createException = useCreateAttendanceException();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<string>('');
  const [reason, setReason] = useState('');

  const handleSubmit = async () => {
    if (!date || !type || !reason.trim()) {
      toast.error('All required fields must be filled');
      return;
    }
    try {
      await createException.mutateAsync({
        date: new Date(date).toISOString(),
        type: type as 'OVERTIME' | 'UNDERTIME' | 'ABSENCE' | 'LATE',
        reason: reason.trim(),
      });
      toast.success('Exception request submitted');
      setOpen(false);
      setDate(new Date().toISOString().split('T')[0]);
      setType('');
      setReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit exception');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New Exception
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit Attendance Exception</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="exception-date">Date</Label>
            <Input
              id="exception-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {EXCEPTION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="exception-reason">Reason</Label>
            <Textarea
              id="exception-reason"
              placeholder="Describe the reason…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createException.isPending}>
            {createException.isPending ? 'Submitting…' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
