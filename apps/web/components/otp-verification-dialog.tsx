'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { type OtpPurpose, sendOtp, verifyOtp } from '@/lib/api/auth';
import {
  formatOtpCountdown,
  getRemainingOtpSeconds,
  OTP_CODE_TTL_SECONDS,
} from '@/lib/otp-countdown';

type OtpVerificationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purpose: OtpPurpose;
  onVerified: (otpProof: string) => void;
  title?: string;
};

export function OtpVerificationDialog({
  open,
  onOpenChange,
  purpose,
  onVerified,
  title = 'Verify your email',
}: OtpVerificationDialogProps) {
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!open) {
      setCode('');
      setSent(false);
      setExpiresAt(null);
      setRemainingSeconds(0);
      return;
    }

    let cancelled = false;
    void (async () => {
      const requestedAt = Date.now();
      setSending(true);
      try {
        await sendOtp(purpose);
        if (!cancelled) {
          setSent(true);
          setExpiresAt(requestedAt + OTP_CODE_TTL_SECONDS * 1000);
          setRemainingSeconds(OTP_CODE_TTL_SECONDS);
          toast.success('Verification code sent to your email');
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Failed to send code');
          onOpenChange(false);
        }
      } finally {
        if (!cancelled) setSending(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, purpose, onOpenChange]);

  useEffect(() => {
    if (!open || !expiresAt) return;

    const updateRemainingTime = () => {
      setRemainingSeconds(getRemainingOtpSeconds(expiresAt));
    };
    updateRemainingTime();
    const interval = window.setInterval(updateRemainingTime, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt, open]);

  const handleResend = async () => {
    const requestedAt = Date.now();
    setSending(true);
    setCode('');
    try {
      await sendOtp(purpose);
      setSent(true);
      setExpiresAt(requestedAt + OTP_CODE_TTL_SECONDS * 1000);
      setRemainingSeconds(OTP_CODE_TTL_SECONDS);
      toast.success('A new verification code was sent to your email');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setSending(false);
    }
  };

  const isExpired = sent && remainingSeconds === 0;

  const handleVerify = async () => {
    if (code.length !== 6 || isExpired) return;
    setVerifying(true);
    try {
      const { otpProof } = await verifyOtp(purpose, code);
      onVerified(otpProof);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            {sending
              ? 'Sending code…'
              : sent
                ? isExpired
                  ? 'This verification code has expired. Send a new code to continue.'
                  : 'Enter the 6-digit code we sent to your email.'
                : 'Preparing verification…'}
          </p>
          {sent ? (
            <p
              className={
                isExpired ? 'text-sm font-medium text-destructive' : 'text-sm text-muted-foreground'
              }
            >
              {isExpired
                ? 'Code expired'
                : `Code expires in ${formatOtpCountdown(remainingSeconds)}`}
            </p>
          ) : null}
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              disabled={sending || verifying || isExpired}
            >
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <InputOTPSlot key={index} index={index} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button
            className="w-full"
            disabled={code.length !== 6 || verifying || sending || isExpired}
            onClick={() => void handleVerify()}
          >
            {verifying ? <Loader2 className="size-4 animate-spin" /> : 'Verify'}
          </Button>
          {isExpired ? (
            <Button
              className="w-full"
              disabled={sending}
              onClick={() => void handleResend()}
              type="button"
              variant="outline"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : 'Send a new code'}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
