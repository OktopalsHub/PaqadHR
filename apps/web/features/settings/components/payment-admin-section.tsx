'use client';

import { Loader2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  usePendingPaymentMethods,
  useVerifyPaymentMethod,
} from '@/hooks/queries/use-payment-methods';
import { useTenant } from '@/providers/tenant-provider';

export function PaymentAdminSection() {
  const { tenant } = useTenant();
  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';
  const { data: pending = [], isLoading } = usePendingPaymentMethods();
  const verify = useVerifyPaymentMethod();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  if (!isAdmin) {
    return null;
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading pending verifications…</p>;
  }

  if (pending.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No employee payment methods are waiting for verification.
      </p>
    );
  }

  const handleVerify = async (paymentMethodId: string) => {
    try {
      await verify.mutateAsync({ paymentMethodId, status: 'verified' });
      toast.success('Payment method verified');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  const openReject = (paymentMethodId: string) => {
    setRejectTargetId(paymentMethodId);
    setRejectReason('');
    setRejectOpen(true);
  };

  const handleReject = async () => {
    if (!rejectTargetId) return;
    if (rejectReason.trim().length < 3) {
      toast.error('Enter a rejection reason');
      return;
    }
    try {
      await verify.mutateAsync({
        paymentMethodId: rejectTargetId,
        status: 'rejected',
        notes: rejectReason.trim(),
      });
      toast.success('Payment method rejected');
      setRejectOpen(false);
      setRejectTargetId(null);
      setRejectReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rejection failed');
    }
  };

  return (
    <div className="space-y-3">
      {pending.map((method) => (
        <div
          key={method.id}
          className="flex flex-col gap-3 rounded-lg border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{method.employeeName}</p>
              <Badge variant="outline">{method.currency}</Badge>
              {method.isPrimary ? <Badge variant="secondary">Primary payroll account</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">{method.displayInfo}</p>
            {method.accountName ? (
              <p className="text-sm text-muted-foreground">Account name: {method.accountName}</p>
            ) : null}
            {method.bankName ? (
              <p className="text-xs text-muted-foreground">Bank: {method.bankName}</p>
            ) : null}
            {method.institutionCode ? (
              <p className="text-xs text-muted-foreground">
                {method.currency === 'USD'
                  ? 'Routing'
                  : method.currency === 'EUR'
                    ? 'BIC'
                    : method.currency === 'GBP'
                      ? 'Sort code'
                      : 'Institution'}
                : {method.institutionCode}
              </p>
            ) : null}
            {method.accountLast4 ? (
              <p className="text-xs text-muted-foreground">Account ending {method.accountLast4}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Submitted {new Date(method.submittedAt ?? method.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={verify.isPending}
              onClick={() => void handleVerify(method.id)}
            >
              {verify.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              <ShieldCheck className="mr-1 size-4" />
              Verify
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={verify.isPending}
              onClick={() => openReject(method.id)}
            >
              Reject
            </Button>
          </div>
        </div>
      ))}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject payment method</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label>Reason (required)</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain what the employee should fix"
                maxLength={500}
                rows={4}
              />
            </div>
            <Button
              variant="destructive"
              className="w-full"
              disabled={verify.isPending}
              onClick={() => void handleReject()}
            >
              Reject account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
