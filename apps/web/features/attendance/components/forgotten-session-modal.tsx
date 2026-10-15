'use client';

import { AlertCircle, Clock, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { canAccessAttendanceFeature } from '@/features/attendance/lib/attendance-feature-access';
import { formatRecordDate, formatTimeOnly } from '@/features/attendance/lib/attendance-utils';
import { useClockInInfo, useClockOut } from '@/hooks/queries/use-attendance';
import { useFeatureAccess } from '@/hooks/queries/use-feature-access';
import { FeatureAccess } from '@/lib/constants/feature-access';

export function ForgottenSessionModal() {
  const { hasFeature, featureGatingEnabled } = useFeatureAccess();
  const canAccessAttendance = canAccessAttendanceFeature(
    featureGatingEnabled,
    hasFeature,
    FeatureAccess.ATTENDANCE,
  );

  if (!canAccessAttendance) {
    return null;
  }

  return <ForgottenSessionModalContent />;
}

function ForgottenSessionModalContent() {
  const { data: info } = useClockInInfo();
  const clockOutMutation = useClockOut();
  const forgottenSession = info?.forgottenSession;

  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Initialize time dynamically to 8 hours after clock-in when forgottenSession changes
  useEffect(() => {
    if (forgottenSession?.clockIn) {
      const clockInDate = new Date(forgottenSession.clockIn);
      const defaultClockOutDate = new Date(clockInDate.getTime() + 8 * 60 * 60 * 1000);
      const defaultHours = String(defaultClockOutDate.getHours()).padStart(2, '0');
      const defaultMinutes = String(defaultClockOutDate.getMinutes()).padStart(2, '0');
      setTime(`${defaultHours}:${defaultMinutes}`);
      setError(null);
      setNotes('');
    }
  }, [forgottenSession]);

  if (!forgottenSession) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!time) {
      setError('Please select a clock out time.');
      return;
    }

    try {
      const clockInDate = new Date(forgottenSession.clockIn);
      const [hours, minutes] = time.split(':').map(Number);
      const clockOutDate = new Date(clockInDate);
      clockOutDate.setHours(hours, minutes, 0, 0);

      if (clockOutDate.getTime() <= clockInDate.getTime()) {
        setError(
          `Clock out time cannot be before or equal to clock in time (${formatTimeOnly(
            forgottenSession.clockIn,
          )}).`,
        );
        return;
      }

      await clockOutMutation.mutateAsync({
        attendanceId: forgottenSession.id,
        clockOut: clockOutDate.toISOString(),
        notes,
      });

      toast.success('Session closed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit clock out time.');
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-[425px]"
        showCloseButton={false}
        // Prevent closing the modal by clicking outside or hitting escape
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-500">
            <Clock className="size-5" />
            <DialogTitle className="text-xl font-bold">Close yesterday’s session</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-sm text-muted-foreground">
            Close your session from {formatRecordDate(forgottenSession.date)} (clocked in{' '}
            {formatTimeOnly(forgottenSession.clockIn)}) before clocking in.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-3">
          <div className="space-y-2">
            <label htmlFor="clock-out-time" className="text-sm font-medium">
              Clock out time
            </label>
            <Input
              id="clock-out-time"
              type="time"
              required
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                setError(null);
              }}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="notes" className="text-sm font-medium">
              Notes (optional)
            </label>
            <Textarea
              id="notes"
              placeholder="Optional notes"
              className="min-h-[60px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="submit"
              variant="brandSolid"
              disabled={clockOutMutation.isPending}
              className="w-full font-medium"
            >
              {clockOutMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Closing…
                </>
              ) : (
                'Close session'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
