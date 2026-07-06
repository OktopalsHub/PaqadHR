'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { type OtpPurpose, sendOtp, verifyOtp } from '@/lib/api/auth';

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

  useEffect(() => {
    if (!open) {
      setCode('');
      setSent(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      setSending(true);
      try {
        await sendOtp(purpose);
        if (!cancelled) {
          setSent(true);
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

  const handleVerify = async () => {
    if (code.length !== 6) return;
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
                ? 'Enter the 6-digit code we sent to your email.'
                : 'Preparing verification…'}
          </p>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={setCode} disabled={sending || verifying}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <InputOTPSlot key={index} index={index} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button
            className="w-full"
            disabled={code.length !== 6 || verifying || sending}
            onClick={() => void handleVerify()}
          >
            {verifying ? <Loader2 className="size-4 animate-spin" /> : 'Verify'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
