'use client';

import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

  const handleVerify = async (paymentMethodId: string, status: 'verified' | 'rejected') => {
    try {
      await verify.mutateAsync({ paymentMethodId, status });
      toast.success(status === 'verified' ? 'Payment method verified' : 'Payment method rejected');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verification failed');
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
            <div className="flex items-center gap-2">
              <p className="font-medium">{method.employeeName}</p>
              <Badge variant="outline">{method.currency}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{method.displayInfo}</p>
            <p className="text-xs text-muted-foreground">
              Submitted {new Date(method.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={verify.isPending}
              onClick={() => handleVerify(method.id, 'verified')}
            >
              {verify.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              <ShieldCheck className="mr-1 size-4" />
              Verify
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={verify.isPending}
              onClick={() => handleVerify(method.id, 'rejected')}
            >
              Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
