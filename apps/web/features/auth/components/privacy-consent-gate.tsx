'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  useAcceptPrivacyPolicy,
  usePrivacyConsentStatus,
} from '@/hooks/queries/use-privacy-consent';
import { useAuth } from '@/providers/auth-provider';

export function PrivacyConsentGate() {
  const { isAuthenticated, user } = useAuth();
  const { data, isLoading } = usePrivacyConsentStatus(user?.id, isAuthenticated);
  const acceptPrivacy = useAcceptPrivacyPolicy(user?.id);
  const [agreed, setAgreed] = useState(false);

  const open = isAuthenticated && !isLoading && Boolean(data?.needsReconsent);

  const handleAccept = async () => {
    try {
      await acceptPrivacy.mutateAsync();
      setAgreed(false);
      toast.success('Privacy policy accepted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not record consent');
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        className="sm:max-w-md"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Updated privacy policy</DialogTitle>
          <DialogDescription>
            We updated our Privacy Policy. Review the changes and accept to keep using Paqad.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2">
          <Checkbox
            id="privacy-reconsent"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked === true)}
          />
          <Label htmlFor="privacy-reconsent" className="text-sm leading-5">
            I have read and accept the updated{' '}
            <Link href="/privacy" className="text-primary hover:underline" target="_blank">
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link href="/terms" className="text-primary hover:underline" target="_blank">
              Terms of Service
            </Link>
            .
          </Label>
        </div>

        <DialogFooter>
          <Button disabled={!agreed || acceptPrivacy.isPending} onClick={() => void handleAccept()}>
            {acceptPrivacy.isPending ? 'Saving…' : 'Accept and continue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
