'use client';

import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Send, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { BankLogo } from '@/components/bank-logo';
import { OtpVerificationDialog } from '@/components/otp-verification-dialog';
import { SearchSelect } from '@/components/search-select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { PasswordInput } from '@/features/auth/components/form-fields/password-input';
import {
  useChangePaymentPasscode,
  useCreatePaymentMethod,
  useDeletePaymentMethod,
  useNigerianBanks,
  usePaymentMethods,
  usePaymentPasscodeStatus,
  useSubmitPaymentMethodForVerification,
  useSupportedPaymentCurrencies,
} from '@/hooks/queries/use-payment-methods';
import { useDebounce } from '@/hooks/use-debounce';
import { lookupNigerianBankAccount } from '@/lib/api/payment-methods';
import {
  getPayoutFieldConfig,
  isGlobalBankCurrency,
  normalizeAccountInput,
  normalizeInstitutionInput,
  validateGlobalBankFields,
} from '@/lib/payout-bank-fields';
import type { PaymentMethodSummary } from '@/lib/schemas/payment-method';
import { useTenant } from '@/providers/tenant-provider';

const COUNTRY_BY_CURRENCY: Record<string, string> = {
  NGN: 'NG',
  USD: 'US',
  GBP: 'GB',
  EUR: 'DE',
};

function statusBadgeVariant(status: string) {
  if (status === 'verified') return 'default' as const;
  if (status === 'rejected') return 'destructive' as const;
  if (status === 'draft') return 'outline' as const;
  return 'secondary' as const;
}

function statusLabel(status: string) {
  if (status === 'pending_verification') return 'Pending review';
  if (status === 'draft') return 'Draft';
  return status.replaceAll('_', ' ');
}

function PaymentMethodActions({ method }: { method: PaymentMethodSummary }) {
  const deleteMethod = useDeletePaymentMethod();
  const submitMethod = useSubmitPaymentMethodForVerification();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [currentPasscode, setCurrentPasscode] = useState('');

  const canSubmit = method.status === 'draft' || method.status === 'rejected';

  useEffect(() => {
    if (!deleteOpen) return;
    setCurrentPasscode('');
  }, [deleteOpen]);

  const requestSubmit = () => {
    if (currentPasscode.length !== 6) {
      toast.error('Payment passcode is required');
      return;
    }
    setOtpOpen(true);
  };

  const handleSubmitForReview = async (otpProof: string) => {
    try {
      await submitMethod.mutateAsync({
        paymentMethodId: method.id,
        passcode: currentPasscode,
        otpProof,
      });
      toast.success('Submitted for admin verification');
      setSubmitOpen(false);
      setCurrentPasscode('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submit failed');
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
    <div className="flex flex-wrap items-center gap-1">
      {canSubmit ? (
        <Button size="sm" variant="outline" onClick={() => setSubmitOpen(true)}>
          <Send className="mr-1 size-3.5" />
          Submit for review
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" onClick={() => setDeleteOpen(true)}>
        <Trash2 className="size-3.5 text-destructive" />
      </Button>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit for verification</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              Send {method.displayInfo} ({method.currency}) to your admin for review.
            </p>
            <div className="space-y-2">
              <Label>Payment passcode</Label>
              <PasswordInput
                maxLength={6}
                value={currentPasscode}
                onChange={(e) => setCurrentPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
            <Button className="w-full" disabled={submitMethod.isPending} onClick={requestSubmit}>
              {submitMethod.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Submit for review
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <OtpVerificationDialog
        open={otpOpen}
        onOpenChange={setOtpOpen}
        purpose="payment_method"
        title="Verify to submit payment method"
        onVerified={(proof) => void handleSubmitForReview(proof)}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete payment method</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label>Payment passcode</Label>
              <PasswordInput
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
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PaymentSettingsSection() {
  const { tenantId } = useTenant();
  const { data: methods = [], isLoading, isError, error } = usePaymentMethods();
  const { data: passcodeStatus } = usePaymentPasscodeStatus();
  const { data: currencies, refetch: refetchCurrencies } = useSupportedPaymentCurrencies();
  const createMethod = useCreatePaymentMethod();
  const changePasscode = useChangePaymentPasscode();
  const [openForm, setOpenForm] = useState(false);
  const [passcodeDialogOpen, setPasscodeDialogOpen] = useState(false);
  const [currency, setCurrency] = useState('NGN');
  const [bankCode, setBankCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [institutionCode, setInstitutionCode] = useState('');
  const [passcode, setPasscode] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);
  const [otpOpen, setOtpOpen] = useState(false);
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');

  const [walletAddress, setWalletAddress] = useState('');
  const [cryptoNetwork, setCryptoNetwork] = useState('');

  const hasPasscode = passcodeStatus?.hasPasscode ?? methods.length > 0;
  const fiatOptions = useMemo(() => currencies?.fiat ?? [], [currencies]);
  const cryptoOptions = useMemo(() => currencies?.crypto ?? [], [currencies]);
  const currencyOptions = useMemo(
    () => [...fiatOptions, ...cryptoOptions],
    [fiatOptions, cryptoOptions],
  );
  const isNgn = currency === 'NGN';
  const isCrypto = cryptoOptions.includes(currency);
  const {
    data: banks = [],
    isLoading: banksLoading,
    isError: banksError,
    error: banksQueryError,
  } = useNigerianBanks({
    enabled: openForm && isNgn,
  });
  const isGlobalBank = isGlobalBankCurrency(currency);
  const payoutConfig = getPayoutFieldConfig(currency);
  const hasAnyPrimary = methods.some((m) => m.isPrimary);

  useEffect(() => {
    if (currencyOptions.length === 0) return;
    if (!currencyOptions.includes(currency)) {
      setCurrency(currencyOptions[0]);
    }
  }, [currency, currencyOptions]);

  useEffect(() => {
    setInstitutionCode('');
    setBankCode('');
    setBankName('');
    setAccountName('');
    setAccountNumber('');
    setWalletAddress('');
    setCryptoNetwork('');
    setIsPrimary(!hasAnyPrimary);
  }, [hasAnyPrimary]);

  const openAddForm = async () => {
    try {
      await refetchCurrencies({ throwOnError: true });
      setWalletAddress('');
      setCryptoNetwork('');
      setOpenForm(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not refresh currencies');
    }
  };

  const bankOptions = useMemo(
    () =>
      banks.map((bank) => ({
        value: bank.code,
        label: bank.name,
        icon: <BankLogo name={bank.name} />,
      })),
    [banks],
  );

  // Bank account lookup via mutation + debounce (PII-safe: no cache, no key leakage, SECURITY.md §5)
  const normalizedAccount = accountNumber.replace(/\D/g, '');
  const debouncedAccount = useDebounce(normalizedAccount, 500);
  const debouncedBankCode = useDebounce(bankCode, 500);
  const selectedBankNameForLookup = banks.find((bank) => bank.code === debouncedBankCode)?.name;
  const bankLookupEnabled =
    isNgn &&
    openForm &&
    debouncedAccount.length === 10 &&
    Boolean(debouncedBankCode) &&
    Boolean(tenantId);

  const bankLookupMutation = useMutation({
    mutationFn: (vars: { accountNumber: string; bankCode: string; bankName?: string }) =>
      lookupNigerianBankAccount(vars),
  });
  const bankLookupRequestRef = useRef(0);

  useEffect(() => {
    if (!bankLookupEnabled) {
      bankLookupMutation.reset();
      return;
    }
    const requestId = ++bankLookupRequestRef.current;
    bankLookupMutation.mutate(
      {
        accountNumber: debouncedAccount,
        bankCode: debouncedBankCode,
        bankName: selectedBankNameForLookup,
      },
      {
        onSuccess: (data) => {
          if (requestId !== bankLookupRequestRef.current) return;
          if (data.accountNumber !== debouncedAccount || data.bankCode !== debouncedBankCode) {
            return;
          }
          setAccountName(data.accountName);
          setBankName(data.bankName);
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedAccount,
    debouncedBankCode,
    bankLookupEnabled,
    selectedBankNameForLookup,
    bankLookupMutation.reset,
    bankLookupMutation.mutate,
  ]);

  const isDebouncingLookup =
    debouncedAccount !== normalizedAccount || debouncedBankCode !== bankCode;
  const shouldShowLookupPending =
    isNgn && openForm && normalizedAccount.length === 10 && Boolean(bankCode);
  const lookupPending =
    shouldShowLookupPending && (isDebouncingLookup || bankLookupMutation.isPending);
  const lookupVerified =
    !isDebouncingLookup &&
    bankLookupMutation.isSuccess &&
    Boolean(bankLookupMutation.data?.accountName) &&
    bankLookupMutation.data.accountNumber === normalizedAccount &&
    bankLookupMutation.data.bankCode === bankCode;
  const rawLookupError = bankLookupMutation.error
    ? bankLookupMutation.error instanceof Error
      ? bankLookupMutation.error.message
      : 'Could not verify account'
    : null;
  const lookupErrorStatus =
    bankLookupMutation.error &&
    typeof bankLookupMutation.error === 'object' &&
    'status' in bankLookupMutation.error
      ? Number((bankLookupMutation.error as { status: number }).status)
      : 0;
  const lookupUnavailable = Boolean(
    rawLookupError &&
      (lookupErrorStatus === 503 ||
        /not available|not configured|unavailable|authenticate with Nomba|Nomba payout/i.test(
          rawLookupError,
        )),
  );
  const lookupError = lookupUnavailable
    ? 'Automatic verification is unavailable. Enter the account name exactly as it appears on your bank statement.'
    : rawLookupError;

  // Clear account name when inputs become invalid, verification fails, or live fields diverge during debounce
  useEffect(() => {
    if (!isNgn) return;
    const normalized = accountNumber.replace(/\D/g, '');
    if (normalized.length !== 10 || !bankCode || (isDebouncingLookup && !lookupUnavailable)) {
      if (!lookupUnavailable) setAccountName('');
      return;
    }
    if (bankLookupMutation.isError && !lookupUnavailable) {
      setAccountName('');
    }
  }, [
    accountNumber,
    bankCode,
    isNgn,
    lookupUnavailable,
    isDebouncingLookup,
    bankLookupMutation.isError,
  ]);

  const handleSubmit = () => {
    if (isCrypto) {
      if (!walletAddress.trim()) {
        toast.error('Wallet address is required');
        return;
      }
      if (!cryptoNetwork.trim()) {
        toast.error('Network is required');
        return;
      }
    } else if (isNgn) {
      if (!bankCode) {
        toast.error('Select your bank');
        return;
      }
      if (accountNumber.replace(/\D/g, '').length !== 10) {
        toast.error('Enter a valid 10-digit Naira account number');
        return;
      }
      if (lookupPending && !lookupUnavailable) {
        toast.error('Waiting for account verification…');
        return;
      }
      if (!lookupVerified && !accountName.trim()) {
        toast.error(
          lookupUnavailable
            ? 'Enter the account name on the account'
            : 'Verify your account number and bank first',
        );
        return;
      }
      if (!lookupVerified && !lookupUnavailable) {
        toast.error('Verify your account number and bank first');
        return;
      }
    } else if (!bankName.trim() || !accountName.trim()) {
      toast.error('Bank name and account name are required');
      return;
    }

    if (isGlobalBank) {
      const validationError = validateGlobalBankFields(currency, accountNumber, institutionCode);
      if (validationError) {
        toast.error(validationError);
        return;
      }
    }

    if (!isCrypto && !accountNumber.trim()) {
      toast.error('Account number is required');
      return;
    }
    if (passcode.length !== 6) {
      toast.error('Passcode must be exactly 6 digits');
      return;
    }

    setOtpOpen(true);
  };

  const submitWithOtp = async (otpProof: string) => {
    try {
      const normalizedAccount = payoutConfig
        ? normalizeAccountInput(accountNumber, payoutConfig)
        : accountNumber.trim();
      const normalizedInstitution = payoutConfig
        ? normalizeInstitutionInput(institutionCode, payoutConfig)
        : bankCode.trim();

      await createMethod.mutateAsync({
        type: isCrypto ? 'crypto' : 'bank',
        currency,
        bankName: isCrypto ? undefined : bankName.trim(),
        bankCode: isCrypto
          ? undefined
          : isNgn
            ? bankCode.trim()
            : normalizedInstitution || undefined,
        accountName: isCrypto ? 'Crypto wallet' : accountName.trim(),
        accountNumber: isCrypto ? walletAddress.trim() : normalizedAccount,
        walletAddress: isCrypto ? walletAddress.trim() : undefined,
        cryptoNetwork: isCrypto ? cryptoNetwork.trim() || undefined : undefined,
        country: isCrypto ? 'NG' : (COUNTRY_BY_CURRENCY[currency] ?? 'NG'),
        passcode,
        otpProof,
        isPrimary,
      });
      setOpenForm(false);
      setBankName('');
      setBankCode('');
      setInstitutionCode('');
      setAccountName('');
      setAccountNumber('');
      setWalletAddress('');
      setCryptoNetwork('');
      setPasscode('');
      toast.success('Payment account saved as draft.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save payment settings');
    }
  };

  const handleChangePasscode = async () => {
    if (currentPasscode.length !== 6 || newPasscode.length !== 6) {
      toast.error('Passcodes must be exactly 6 digits');
      return;
    }
    try {
      await changePasscode.mutateAsync({ currentPasscode, newPasscode });
      toast.success('Payment passcode changed');
      setPasscodeDialogOpen(false);
      setCurrentPasscode('');
      setNewPasscode('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Passcode change failed');
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
                {method.status === 'rejected' && method.verificationNotes ? (
                  <p className="mt-1 text-xs text-destructive">
                    Rejected: {method.verificationNotes}
                  </p>
                ) : null}

                {method.status === 'pending_verification' ? (
                  <p className="mt-1 text-xs text-muted-foreground">Submitted for admin review.</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusBadgeVariant(method.status)}>
                  {statusLabel(method.status)}
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

      {hasPasscode ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setPasscodeDialogOpen(true)}>
            Change payment passcode
          </Button>
        </div>
      ) : null}

      {openForm ? (
        <div className="grid gap-3 rounded-lg border border-border/60 p-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Currency</Label>
            {currencyOptions.length <= 1 ? (
              <Input value={currencyOptions[0] ?? currency} readOnly disabled />
            ) : (
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {isCrypto ? (
            <>
              <div className="space-y-2 sm:col-span-2">
                <Label>Wallet address</Label>
                <Input
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="Paste your wallet address"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Network</Label>
                <Input
                  value={cryptoNetwork}
                  onChange={(e) => setCryptoNetwork(e.target.value)}
                  placeholder="e.g. ERC20, TRC20, Solana"
                />
              </div>
            </>
          ) : isNgn ? (
            <>
              <div className="space-y-2 sm:col-span-2">
                <Label>Bank</Label>
                <SearchSelect
                  options={bankOptions}
                  value={bankCode}
                  onValueChange={(value) => {
                    setBankCode(value);
                    const selected = banks.find((bank) => bank.code === value);
                    setBankName(selected?.name ?? '');
                  }}
                  placeholder={banksLoading ? 'Loading banks…' : 'Search bank'}
                  disabled={banksLoading}
                />
                {banksError ? (
                  <p className="text-xs text-destructive">
                    {banksQueryError instanceof Error
                      ? banksQueryError.message
                      : 'Could not load banks'}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Account number</Label>
                <Input
                  inputMode="numeric"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit account number"
                />
                {lookupPending ? (
                  <p className="text-xs text-muted-foreground">Looking up account…</p>
                ) : null}
                {lookupVerified ? (
                  <p className="flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="size-3" />
                    Account verified
                  </p>
                ) : null}
                {lookupError ? <p className="text-xs text-destructive">{lookupError}</p> : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Account name</Label>
                <Input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  readOnly={lookupVerified && !lookupUnavailable}
                />
              </div>
            </>
          ) : isGlobalBank && payoutConfig ? (
            <>
              <div className="space-y-2 sm:col-span-2">
                <Label>Bank name</Label>
                <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{payoutConfig.institutionLabel}</Label>
                <Input
                  value={institutionCode}
                  placeholder={payoutConfig.institutionPlaceholder}
                  onChange={(e) =>
                    setInstitutionCode(normalizeInstitutionInput(e.target.value, payoutConfig))
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{payoutConfig.accountLabel}</Label>
                <Input
                  value={accountNumber}
                  placeholder={payoutConfig.accountPlaceholder}
                  onChange={(e) =>
                    setAccountNumber(normalizeAccountInput(e.target.value, payoutConfig))
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Account name</Label>
                <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} />
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
              <div className="space-y-2 sm:col-span-2">
                <Label>Account number</Label>
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 17))}
                />
              </div>
            </>
          )}

          <div className="flex items-center gap-2 sm:col-span-2">
            <Checkbox
              id="is-primary"
              checked={isPrimary}
              disabled={!isPrimary && !hasAnyPrimary}
              onCheckedChange={(checked) => setIsPrimary(checked === true)}
            />
            <Label htmlFor="is-primary">
              Use for payroll ({currency})
              {!isPrimary && !hasAnyPrimary
                ? ' — Required: you need at least one primary account'
                : ''}
            </Label>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>{hasPasscode ? 'Enter payment passcode' : 'Set payment passcode'}</Label>
            <PasswordInput
              inputMode="numeric"
              maxLength={6}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <p className="text-xs text-muted-foreground">
              {hasPasscode
                ? 'Use the same 6-digit passcode for all payment actions.'
                : 'Create a 6-digit passcode. You will use it for all payment accounts.'}
            </p>
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
        <Button size="sm" variant="outline" onClick={openAddForm}>
          {methods.length ? 'Add another account' : 'Add bank account'}
        </Button>
      )}

      <Dialog open={passcodeDialogOpen} onOpenChange={setPasscodeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change payment passcode</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label>Current passcode</Label>
              <PasswordInput
                maxLength={6}
                value={currentPasscode}
                onChange={(e) => setCurrentPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
            <div className="space-y-2">
              <Label>New passcode</Label>
              <PasswordInput
                maxLength={6}
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
            <Button
              className="w-full"
              disabled={changePasscode.isPending}
              onClick={() => void handleChangePasscode()}
            >
              Update passcode
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <OtpVerificationDialog
        open={otpOpen}
        onOpenChange={setOtpOpen}
        purpose="payment_method"
        title="Verify to save payment method"
        onVerified={(proof) => void submitWithOtp(proof)}
      />
    </div>
  );
}
