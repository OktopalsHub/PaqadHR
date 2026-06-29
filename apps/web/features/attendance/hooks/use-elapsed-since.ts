'use client';

import { useEffect, useState } from 'react';
import { formatElapsedMs } from '@/features/attendance/lib/attendance-utils';

export function useElapsedSince(clockIn?: string | null): string {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!clockIn) {
      setElapsed('');
      return;
    }

    const startedAt = new Date(clockIn).getTime();
    if (Number.isNaN(startedAt)) {
      setElapsed('');
      return;
    }

    const tick = () => setElapsed(formatElapsedMs(Date.now() - startedAt));

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [clockIn]);

  return elapsed;
}
