'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { LoadingBlock } from '@/components/loading-block';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/features/auth/components/form-fields/password-input';
import { useAuth } from '@/hooks/use-auth';
import { login } from '@/lib/api/auth';
import {
  acceptInvitation,
  declineInvitation,
  fetchInvitationDetails,
  type InvitationDetails,
} from '@/lib/api/invitations';
import { fetchUserTenants } from '@/lib/api/tenants';
import { tenantUrl } from '@/lib/navigation/tenant-routes';
import { queryKeys } from '@/lib/query/keys';
import { persistTenantId, persistTenantSlug } from '@/lib/session';

function buildAcceptInvitePath(token: string, email: string) {
  return `/accept-invite?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
}

export function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [password, setPassword] = useState('');

  const invitePath = useMemo(
    () => (token && email ? buildAcceptInvitePath(token, email) : '/accept-invite'),
    [token, email],
  );

  const redirectToWorkspace = useCallback(
    async (tenantSlug?: string, tenantId?: string) => {
      if (tenantId) persistTenantId(tenantId);
      if (tenantSlug) persistTenantSlug(tenantSlug);

      if (tenantSlug) {
        window.location.assign(tenantUrl(tenantSlug, '/'));
        return;
      }

      const tenants = await fetchUserTenants();
      const match = tenants.find((item) => item.id === tenantId) ?? tenants[0];
      if (match?.slug) {
        persistTenantSlug(match.slug);
        window.location.assign(tenantUrl(match.slug, '/'));
        return;
      }

      router.replace('/onboarding');
    },
    [router],
  );

  const handleAccept = useCallback(async () => {
    if (!token || !email) return;

    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First and last name are required.');
      return;
    }

    if (!details?.userExists && password.trim().length < 8) {
      toast.error('Choose a password with at least 8 characters.');
      return;
    }

    if (isAuthenticated && user?.email.toLowerCase() !== email.toLowerCase()) {
      toast.error('Sign in with the invited email address to accept this invitation.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await acceptInvitation({
        token,
        email,
        password: details?.userExists ? undefined : password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        preferredName: preferredName.trim() || undefined,
      });

      if (!details?.userExists) {
        await login({ email, password, rememberMe: true });
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all });

      toast.success(result.message || 'Welcome to your workspace.');
      await redirectToWorkspace(
        result.data.invitation.tenantSlug ?? details?.tenantSlug,
        result.data.invitation.tenantId,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    token,
    email,
    details,
    password,
    firstName,
    lastName,
    preferredName,
    isAuthenticated,
    user?.email,
    redirectToWorkspace,
    queryClient,
  ]);

  useEffect(() => {
    if (!token || !email) {
      setLoadError('This invitation link is incomplete.');
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    void fetchInvitationDetails(token, email)
      .then((data) => {
        if (cancelled) return;
        setDetails(data);
        if (data.firstName?.trim()) setFirstName(data.firstName.trim());
        if (data.lastName?.trim()) setLastName(data.lastName.trim());
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Unable to load invitation');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, email]);

  if (isLoading || authLoading) {
    return (
      <div className="py-12">
        <LoadingBlock />
      </div>
    );
  }

  if (loadError || !details) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Invitation unavailable</h1>
        <p className="text-sm text-muted-foreground">{loadError ?? 'Invitation not found.'}</p>
        <Button asChild variant="brandSolid">
          <Link href="/signin">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  const signedInWrongAccount = isAuthenticated && user?.email.toLowerCase() !== email.toLowerCase();
  const showProfileFields =
    !details.userExists || (details.userExists && isAuthenticated && !signedInWrongAccount);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Join {details.tenantName}</h1>
        <p className="text-sm text-muted-foreground">
          You&apos;ve been invited to join as{' '}
          <span className="font-medium capitalize text-foreground">{details.role}</span>.
        </p>
      </div>

      <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm">
        <p className="font-medium">{details.email}</p>
        <p className="mt-1 text-muted-foreground">
          Expires{' '}
          {new Date(details.expiresAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
        </p>
      </div>

      {signedInWrongAccount ? (
        <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <p>
            You&apos;re signed in as <strong>{user?.email}</strong>. Sign in with{' '}
            <strong>{details.email}</strong> to accept this invitation.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/signin?redirect=${encodeURIComponent(invitePath)}`}>
              Sign in with invited email
            </Link>
          </Button>
        </div>
      ) : null}

      {showProfileFields ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {details.userExists
              ? `Confirm your name to join ${details.tenantName}.`
              : `Set up your profile to join ${details.tenantName}.`}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferredName">
              Preferred name <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="preferredName"
              value={preferredName}
              onChange={(event) => setPreferredName(event.target.value)}
              placeholder="How you'd like to be called"
              autoComplete="nickname"
            />
          </div>
          {!details.userExists ? (
            <div className="space-y-2">
              <Label htmlFor="password">Create password</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                className="h-11"
                autoComplete="new-password"
              />
            </div>
          ) : null}
        </div>
      ) : !details.userExists ? null : !isAuthenticated ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You already have a Paqad account. Sign in to accept this invitation.
          </p>
          <Button asChild className="w-full h-11">
            <Link href={`/signin?redirect=${encodeURIComponent(invitePath)}`}>
              Sign in to accept
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        {showProfileFields ? (
          <Button
            className="h-11 flex-1"
            onClick={() => void handleAccept()}
            disabled={isSubmitting || signedInWrongAccount}
          >
            {isSubmitting ? 'Joining…' : 'Accept invitation'}
          </Button>
        ) : null}
        <Button
          variant="outline"
          className="h-11 flex-1"
          disabled={isSubmitting}
          onClick={async () => {
            setIsSubmitting(true);
            try {
              await declineInvitation({ token, email });
              toast.success('Invitation declined');
              router.replace('/signin');
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Failed to decline invitation');
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}
