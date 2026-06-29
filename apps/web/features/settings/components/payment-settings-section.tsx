'use client';

import { Banknote, CheckCircle2, Loader2, Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { SearchSelect } from '@/components/search-select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  useChangePaymentMethodPasscode,
  useCreatePaymentMethod,
  useDeletePaymentMethod,
  useNigerianBanks,
  usePaymentMethods,
  useSupportedPaymentCurrencies,
  useUpdatePaymentMethod,
} from '@/hooks/queries/use-payment-methods';
import { lookupNigerianBankAccount } from '@/lib/api/payment-methods';
import type { PaymentMethodSummary } from '@/lib/schemas/payment-method';

const COUNTRY_BY_CURRENCY: Record<string, string> = {
  NGN: 'NG',
  USD: 'US',
  GBP: 'GB',
  EUR: 'DE',
  KES: 'KE',
  GHS: 'GH',
  ZAR: 'ZA',
};

function statusBadgeVariant(status: string) {
  if (status === 'verified') return 'default' as const;
  if (status === 'rejected') return 'destructive' as const;
  return 'secondary' as const;
}

function PaymentMethodActions({ method }: { method: PaymentMethodSummary }) {
  const updateMethod = useUpdatePaymentMethod();
  const deleteMethod = useDeletePaymentMethod();
  const changePasscode = useChangePaymentMethodPasscode();
  const [editOpen, setEditOpen] = useState(false);
  const [passcodeOpen, setPasscodeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');

  const handleEdit = async () => {
    if (currentPasscode.length !== 6) {
      toast.error('Current passcode is required');
      return;
    }
    try {
      await updateMethod.mutateAsync({
        paymentMethodId: method.id,
        input: {
          currentPasscode,
          accountName: accountName.trim() || undefined,
          accountNumber: accountNumber.trim() || undefined,
          bankName: bankName.trim() || undefined,
        },
      });
      toast.success('Payment method updated');
      setEditOpen(false);
      setCurrentPasscode('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleChangePasscode = async () => {
    if (currentPasscode.length !== 6 || newPasscode.length !== 6) {
      toast.error('Passcodes must be exactly 6 digits');
      return;
    }
    try {
      await changePasscode.mutateAsync({
        paymentMethodId: method.id,
        currentPasscode,
        newPasscode,
      });
      toast.success('Passcode changed');
      setPasscodeOpen(false);
      setCurrentPasscode('');
      setNewPasscode('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Passcode change failed');
    }
  };

  const handleDelete = async () => {
    if (currentPasscode.length !== 6) {
      toast.error('Passcode is required to delete');
      return;
    }
    try {
      await deleteMethod.mutateAsync({ paymentMethodId: method.id, passcode: currentPasscode });
      toast.success('Payment method deleted');
      setDeleteOpen(false);
      setCurrentPasscode('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="flex flex-wrap gap-1">
      <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
        <Pencil className="size-3.5" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setPasscodeOpen(true)}>
        Passcode
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setDeleteOpen(true)}>
        <Trash2 className="size-3.5 text-destructive" />
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit bank details</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label>Bank name</Label>
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Account name</Label>
              <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Account number</Label>
              <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Current passcode</Label>
              <Input
                type="password"
                maxLength={6}
                value={currentPasscode}
                onChange={(e) => setCurrentPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
            <Button className="w-full" disabled={updateMethod.isPending} onClick={handleEdit}>
              Save changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={passcodeOpen} onOpenChange={setPasscodeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change passcode</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label>Current passcode</Label>
              <Input
                type="password"
                maxLength={6}
                value={currentPasscode}
                onChange={(e) => setCurrentPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
            <div className="space-y-2">
              <Label>New passcode</Label>
              <Input
                type="password"
                maxLength={6}
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
            <Button
              className="w-full"
              disabled={changePasscode.isPending}
              onClick={handleChangePasscode}
            >
              Update passcode
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete payment method</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              This removes the bank account from payroll. Enter your passcode to confirm.
            </p>
            <div className="space-y-2">
              <Label>Passcode</Label>
              <Input
                type="password"
                maxLength={6}
                value={currentPasscode}
                onChange={(e) => setCurrentPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
            <Button
              variant="destructive"
              className="w-full"
              disabled={deleteMethod.isPending}
              onClick={handleDelete}
            >
              Delete account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PaymentSettingsSection() {
  const { data: methods = [], isLoading, isError, error } = usePaymentMethods();
  const { data: currencies } = useSupportedPaymentCurrencies();
  const { data: banks = [], isLoading: banksLoading } = useNigerianBanks();
  const createMethod = useCreatePaymentMethod();
  const [openForm, setOpenForm] = useState(false);
  const [currency, setCurrency] = useState('NGN');
  const [bankCode, setBankCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [passcode, setPasscode] = useState('');
  const [lookupVerified, setLookupVerified] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const fiatOptions = currencies?.fiat ?? [];
  const isNgn = currency === 'NGN';

  useEffect(() => {
    if (fiatOptions.length === 0) return;
    if (!fiatOptions.includes(currency)) {
      setCurrency(fiatOptions[0]);
    }
  }, [currency, fiatOptions]);

  const bankOptions = useMemo(
    () => banks.map((bank) => ({ value: bank.code, label: bank.name })),
    [banks],
  );

  useEffect(() => {
    if (!isNgn) {
      setLookupVerified(false);
      setLookupError(null);
      return;
    }

    const normalized = accountNumber.replace(/\D/g, '');
    if (normalized.length !== 10 || !bankCode) {
      setAccountName('');
      setLookupVerified(false);
      setLookupError(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const selectedBank = banks.find((bank) => bank.code === bankCode);
        const result = await lookupNigerianBankAccount({
          accountNumber: normalized,
          bankCode,
          bankName: selectedBank?.name,
        });
        if (cancelled) return;
        setAccountName(result.accountName);
        setBankName(result.bankName);
        setLookupVerified(true);
        setLookupError(null);
      } catch (err) {
        if (cancelled) return;
        setAccountName('');
        setLookupVerified(false);
        setLookupError(err instanceof Error ? err.message : 'Could not verify account');
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [accountNumber, bankCode, banks, isNgn]);

  const handleSubmit = async () => {
    if (isNgn) {
      if (!bankCode || !lookupVerified || !accountName.trim()) {
        toast.error('Verify your account number and bank first');
        return;
      }
    } else if (!bankName.trim() || !accountName.trim()) {
      toast.error('Bank name and account name are required');
      return;
    }

    if (!accountNumber.trim()) {
      toast.error('Account number is required');
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
      setLookupVerified(false);
      setLookupError(null);
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
          Add the account where you want salary paid. For NGN accounts, enter your account number
          and bank — we will verify the account name automatically.
        </AlertDescription>
      </Alert>

      {methods.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payment method on file yet.</p>
      ) : (
        <div className="space-y-2">
          {methods.map((method) => (
            <div
              key={method.id}
              className="flex flex-col gap-3 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium">{method.displayInfo}</p>
                <p className="text-xs text-muted-foreground">{method.currency}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusBadgeVariant(method.status)}>
                  {method.status.replaceAll('_', ' ')}
                </Badge>
                {method.isPrimary ? <Badge variant="secondary">Primary</Badge> : null}
                {method.canReceivePayments ? (
                  <Badge>
                    <ShieldCheck className="mr-1 size-3" />
                    Ready
                  </Badge>
                ) : (
                  <Badge variant="destructive">Incomplete</Badge>
                )}
                <PaymentMethodActions method={method} />
              </div>
            </div>
          ))}
        </div>
      )}

      {openForm ? (
        <div className="grid gap-3 rounded-lg border border-border/60 p-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Currency</Label>
            {fiatOptions.length <= 1 ? (
              <Input value={fiatOptions[0] ?? currency} readOnly disabled />
            ) : (
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
            )}
            <p className="text-xs text-muted-foreground">
              Your workspace only accepts payroll accounts in{' '}
              {fiatOptions.length ? fiatOptions.join(', ') : 'the configured currencies'}.
            </p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Account number</Label>
            <Input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 17))}
              inputMode="numeric"
              placeholder={isNgn ? '10-digit account number' : 'Account number'}
            />
          </div>

          {isNgn ? (
            <>
              <div className="space-y-2 sm:col-span-2">
                <Label>Bank</Label>
                {banksLoading ? (
                  <p className="text-sm text-muted-foreground">Loading banks…</p>
                ) : (
                  <SearchSelect
                    options={bankOptions}
                    value={bankCode}
                    onValueChange={(code) => {
                      setBankCode(code);
                      const selected = banks.find((bank) => bank.code === code);
                      setBankName(selected?.name ?? '');
                    }}
                    placeholder="Select your bank"
                    searchPlaceholder="Search banks…"
                  />
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Account name</Label>
                <div className="relative">
                  <Input value={accountName} readOnly placeholder="Verified automatically" />
                  {lookupVerified ? (
                    <CheckCircle2 className="absolute right-3 top-2.5 size-4 text-green-600" />
                  ) : null}
                </div>
                {lookupError ? (
                  <p className="text-xs text-destructive">{lookupError}</p>
                ) : lookupVerified ? (
                  <p className="text-xs text-muted-foreground">Account verified</p>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Bank name</Label>
                <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Account name</Label>
                <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} />
              </div>
            </>
          )}

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
