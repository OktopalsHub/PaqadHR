'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { clearAccessCookie, login as loginRequest } from '@/lib/api/auth';
import { pauseAuthRefresh, resumeAuthRefresh, startProactiveRefresh } from '@/lib/api/auth-refresh';
import { bootstrapCsrf } from '@/lib/api/client';
import { getGoogleAuthUrl, prepareGoogleAuthConsent } from '@/lib/api/google-auth';
import {
  clearIdleLock,
  type IdleLockState,
  isIdlePastThreshold,
  readIdleLock,
  touchLastActivity,
  writeIdleLock,
} from '@/lib/auth/idle-lock';
import { PasswordInput } from './form-fields/password-input';

type IdleLockGateProps = {
  /** When true, watch for idle and engage soft lock. Existing locks stay until unlock. */
  monitor: boolean;
  email: string | null;
  hasPassword: boolean;
  onUnlocked: () => void;
};

export function IdleLockGate({ monitor, email, hasPassword, onUnlocked }: IdleLockGateProps) {
  const [lock, setLock] = useState<IdleLockState | null>(() => readIdleLock());
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleStarting, setGoogleStarting] = useState(false);

  useEffect(() => {
    const existing = readIdleLock();
    if (existing) {
      pauseAuthRefresh();
      setLock(existing);
      return;
    }

    if (!monitor || !email) {
      setLock(null);
      return;
    }

    touchLastActivity();

    const onActivity = () => {
      if (readIdleLock()) return;
      touchLastActivity();
    };

    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    for (const event of events) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    const timer = window.setInterval(() => {
      if (readIdleLock()) return;
      if (!isIdlePastThreshold()) return;

      const next: IdleLockState = { email, hasPassword };
      writeIdleLock(next);
      pauseAuthRefresh();
      void clearAccessCookie().catch(() => {
        // Cookie clear is best-effort; overlay still blocks the UI.
      });
      setLock(next);
    }, 60_000);

    return () => {
      window.clearInterval(timer);
      for (const event of events) {
        window.removeEventListener(event, onActivity);
      }
    };
  }, [monitor, email, hasPassword]);

  const unlockWithPassword = async () => {
    if (!lock || !password) return;
    setSubmitting(true);
    try {
      await loginRequest({ email: lock.email, password, rememberMe: true });
      await bootstrapCsrf();
      clearIdleLock();
      touchLastActivity();
      resumeAuthRefresh();
      startProactiveRefresh();
      setLock(null);
      setPassword('');
      onUnlocked();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not unlock session');
    } finally {
      setSubmitting(false);
    }
  };

  const unlockWithGoogle = async () => {
    if (googleStarting) return;
    try {
      setGoogleStarting(true);
      await prepareGoogleAuthConsent();
      window.location.assign(getGoogleAuthUrl());
    } catch (error) {
      setGoogleStarting(false);
      toast.error(error instanceof Error ? error.message : 'Could not start Google unlock');
    }
  };

  if (!lock) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-lock-title"
    >
      <div className="w-full max-w-md rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.55)]">
        <h2
          id="idle-lock-title"
          className="text-xl font-semibold tracking-[-0.03em] text-slate-950"
        >
          Session locked
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          You&apos;ve been idle for a while. Confirm it&apos;s you to continue as{' '}
          <span className="font-medium text-slate-700">{lock.email}</span>.
        </p>

        {lock.hasPassword ? (
          <div className="mt-5 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="idle-lock-password">Password</Label>
              <PasswordInput
                id="idle-lock-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void unlockWithPassword();
                }}
                autoFocus
                placeholder="Enter your password"
              />
            </div>
            <Button
              type="button"
              variant="brandSolid"
              className="h-11 w-full rounded-[16px]"
              disabled={submitting || password.length === 0}
              onClick={() => void unlockWithPassword()}
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : 'Unlock'}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="mt-5 h-11 w-full rounded-[16px]"
            disabled={googleStarting}
            onClick={() => void unlockWithGoogle()}
          >
            {googleStarting ? <Loader2 className="size-4 animate-spin" /> : 'Continue with Google'}
          </Button>
        )}
      </div>
    </div>
  );
}
