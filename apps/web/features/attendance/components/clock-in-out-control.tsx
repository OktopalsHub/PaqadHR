'use client';

import { Loader2, LogIn, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useElapsedSince } from '@/features/attendance/hooks/use-elapsed-since';
import { formatTimeOnly } from '@/features/attendance/lib/attendance-utils';
import { useClockIn, useClockInInfo, useClockOut } from '@/hooks/queries/use-attendance';
import { useFeatureAccess } from '@/hooks/queries/use-feature-access';
import { useClockInEnabled } from '@/hooks/queries/use-tenant-settings';
import { FeatureAccess } from '@/lib/constants/feature-access';
import { cn } from '@/lib/utils';

export function ClockInOutControl() {
  const { hasFeature, featureGatingEnabled } = useFeatureAccess();
  const canAccessAttendance = !featureGatingEnabled || hasFeature(FeatureAccess.ATTENDANCE);

  if (!canAccessAttendance) {
    return null;
  }

  return <ClockInOutControlContent />;
}

function ClockInOutControlContent() {
  const { enabled: clockInEnabled, isLoading: settingsLoading } = useClockInEnabled();
  const { data: info, isLoading: infoLoading } = useClockInInfo();
  const clockInMutation = useClockIn();
  const clockOutMutation = useClockOut();

  const activeSession = info?.activeSession ?? null;
  const elapsed = useElapsedSince(activeSession?.clockIn);
  const busy = clockInMutation.isPending || clockOutMutation.isPending;

  if (settingsLoading || !clockInEnabled) {
    return null;
  }

  if (infoLoading || !info) {
    return null;
  }

  const handleClockIn = async () => {
    try {
      await clockInMutation.mutateAsync({});
      toast.success('Clocked in');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clock in');
    }
  };

  const handleClockOut = async () => {
    if (!activeSession?.id) return;
    try {
      await clockOutMutation.mutateAsync({ attendanceId: activeSession.id });
      toast.success('Clocked out');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clock out');
    }
  };

  if (activeSession) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="hidden rounded-md border border-green-200/80 bg-green-50 px-2 py-1 text-xs tabular-nums font-medium text-green-800 sm:block dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-200"
          aria-live="polite"
        >
          {elapsed || '—'}
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                disabled={busy}
                onClick={handleClockOut}
                className={cn(
                  'h-8 gap-1.5 bg-red-600 text-white hover:bg-red-700',
                  'dark:bg-red-700 dark:hover:bg-red-600',
                )}
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <LogOut className="size-3.5" />
                )}
                <span className="hidden sm:inline">Clock out</span>
                <span className="tabular-nums sm:hidden">{elapsed || 'Out'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clocked in at {formatTimeOnly(activeSession.clockIn)}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            disabled={busy || !info.canClockIn}
            onClick={handleClockIn}
            className={cn(
              'h-8 gap-1.5',
              info.canClockIn &&
                !busy &&
                'bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600',
            )}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <LogIn className="size-3.5" />}
            {busy ? 'Clocking in…' : 'Clock in'}
          </Button>
        </TooltipTrigger>
        {!info.canClockIn ? <TooltipContent>{info.reason}</TooltipContent> : null}
      </Tooltip>
    </TooltipProvider>
  );
}
