'use client';

import { Banknote, Loader2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCreatePaymentMethod,
  usePaymentMethods,
  useSupportedPaymentCurrencies,
} from '@/hooks/queries/use-payment-methods';

const COUNTRY_BY_CURRENCY: Record<string, string> = {
  NGN: 'NG',
  USD: 'US',
  GBP: 'GB',
  EUR: 'DE',
  KES: 'KE',
  GHS: 'GH',
  ZAR: 'ZA',
};

export function PaymentSettingsSection() {
  const { data: methods = [], isLoading, isError, error } = usePaymentMethods();
  const { data: currencies } = useSupportedPaymentCurrencies();
  const createMethod = useCreatePaymentMethod();
  const [openForm, setOpenForm] = useState(false);
  const [currency, setCurrency] = useState('NGN');
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [passcode, setPasscode] = useState('');

  const fiatOptions = currencies?.fiat ?? ['NGN', 'USD', 'GBP', 'EUR', 'KES', 'GHS', 'ZAR'];

  const handleSubmit = async () => {
    if (!bankName.trim() || !accountName.trim() || !accountNumber.trim()) {
      toast.error('Bank name, account name, and account number are required');
      return;
    }
    if (currency === 'NGN' && !bankCode.trim()) {
      toast.error('Bank code is required for NGN currency');
      return;
    }
    if (passcode.length !== 6) {
      toast.error('Passcode must be exactly 6 digits');
      return;
    }
    try {
      await createMethod.mutateAsync({
        currency,
        bankName: bankName.trim(),
        bankCode: bankCode.trim() || undefined,
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
        country: COUNTRY_BY_CURRENCY[currency] ?? 'NG',
        passcode,
        isPrimary: true,
      });
      setOpenForm(false);
      setBankName('');
      setBankCode('');
      setAccountName('');
      setAccountNumber('');
      setPasscode('');
      toast.success('Payment settings saved. An admin may need to verify your account.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save payment settings');
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading payment settings…</p>;
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load payment settings</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Something went wrong'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <Banknote className="size-4" />
        <AlertTitle>Payroll bank account</AlertTitle>
        <AlertDescription>
          Add the account where you want salary paid. Without verified payment settings, you may be
          skipped on payroll runs.
        </AlertDescription>
      </Alert>

      {methods.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payment method on file yet.</p>
      ) : (
        <div className="space-y-2">
          {methods.map((method) => (
            <div
              key={method.id}
              className="flex items-center justify-between rounded-lg border border-border/60 p-3"
            >
              <div>
                <p className="text-sm font-medium">{method.displayInfo}</p>
                <p className="text-xs text-muted-foreground">
                  {method.currency} · {method.status.replaceAll('_', ' ')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {method.isPrimary ? <Badge variant="secondary">Primary</Badge> : null}
                {method.canReceivePayments ? (
                  <Badge>
                    <ShieldCheck className="mr-1 size-3" />
                    Ready
                  </Badge>
                ) : (
                  <Badge variant="destructive">Incomplete</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {openForm ? (
        <div className="grid gap-3 rounded-lg border border-border/60 p-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fiatOptions.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Bank name</Label>
            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Bank code</Label>
            <Input
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              placeholder={currency === 'NGN' ? 'Required for NGN' : 'Routing / sort code'}
            />
          </div>
          <div className="space-y-2">
            <Label>Account name</Label>
            <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Account number</Label>
            <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>6-digit passcode</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button disabled={createMethod.isPending} onClick={handleSubmit}>
              {createMethod.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Save payment settings
            </Button>
            <Button variant="outline" onClick={() => setOpenForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpenForm(true)}>
          {methods.length ? 'Add another account' : 'Add bank account'}
        </Button>
      )}
    </div>
  );
}
