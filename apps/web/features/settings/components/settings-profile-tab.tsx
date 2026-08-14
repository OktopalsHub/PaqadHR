'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AvatarUpload } from '@/components/avatar-upload';
import { ContentCard } from '@/components/content-card';
import { LoadingBlock } from '@/components/loading-block';
import { OtpVerificationDialog } from '@/components/otp-verification-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PaymentSettingsSection } from '@/features/settings/components/payment-settings-section';
import { PrivacySection } from '@/features/settings/components/privacy-section';
import { SettingsFieldHint } from '@/features/settings/components/settings-field-hint';
import { SettingsFormActions } from '@/features/settings/components/settings-form-actions';
import { useMemberAvatarUpload } from '@/hooks/queries/use-image-upload';
import {
  memberFullName,
  memberInitials,
  useMemberProfile,
  useUpdateMemberProfile,
} from '@/hooks/queries/use-member-profile';
import { useAuth } from '@/hooks/use-auth';
import { changePassword, fetchAuthSecurity } from '@/lib/api/auth';

export function SettingsProfileTab() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useMemberProfile();
  const updateProfile = useUpdateMemberProfile();
  const avatarUpload = useMemberAvatarUpload({ isSelf: true });

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpProof, setOtpProof] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const { data: security } = useQuery({
    queryKey: ['auth', 'security'],
    queryFn: fetchAuthSecurity,
  });

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.firstName?.trim() ?? '');
    setLastName(profile.lastName?.trim() ?? '');
    setPreferredName(profile.preferredName?.trim() ?? '');
    setAvatarUrl(profile.avatarUrl ?? null);
  }, [profile]);

  const name = memberFullName(profile);
  const initials = memberInitials(profile);

  const saveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First name and last name are required');
      return;
    }

    try {
      await updateProfile.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        preferredName: preferredName.trim() || undefined,
      });
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  const handleChangePassword = async () => {
    if (!otpProof) {
      setOtpOpen(true);
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(otpProof, newPassword);
      toast.success('Password changed');
      setOtpProof(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
      setOtpProof(null);
    } finally {
      setChangingPassword(false);
    }
  };

  if (isLoading) {
    return <LoadingBlock />;
  }

  return (
    <div className="space-y-5">
      <div className="dashboard-panel flex flex-col gap-5 rounded-[8px] px-6 py-6 sm:flex-row sm:items-center">
        <div className="dashboard-soft-tile flex justify-center rounded-[8px] px-4 py-4 sm:justify-start">
          <AvatarUpload
            src={avatarUrl}
            alt={name}
            fallback={initials}
            size="lg"
            disabled={avatarUpload.isPending}
            onUpload={async (file) => {
              const url = await avatarUpload.mutateAsync(file);
              if (url) setAvatarUrl(url);
              return url;
            }}
            onError={(message) => toast.error(message)}
          />
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="dashboard-outline-label text-[11px] font-semibold uppercase">Account</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            {name}
          </h2>
          {profile?.position?.title ? (
            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-400">
              {profile.position.title}
            </p>
          ) : null}
          {user?.email ? (
            <p
              className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400"
              title={user.email}
            >
              {user.email}
            </p>
          ) : null}
        </div>
      </div>

      <ContentCard title="Personal details">
        <div className="grid gap-3 sm:grid-cols-2">
          <SettingsFieldHint label="First name">
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </SettingsFieldHint>
          <SettingsFieldHint label="Last name">
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </SettingsFieldHint>
          <SettingsFieldHint label="Preferred name" className="sm:col-span-2">
            <Input
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              placeholder="Optional"
            />
          </SettingsFieldHint>
          <div className="sm:col-span-2">
            <SettingsFormActions onSave={saveProfile} isPending={updateProfile.isPending} />
          </div>
        </div>
      </ContentCard>

      {security?.canChangePassword ? (
        <ContentCard title="Security">
          <div className="grid gap-3 sm:max-w-md">
            <SettingsFieldHint label="New password">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </SettingsFieldHint>
            <SettingsFieldHint label="Confirm new password">
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </SettingsFieldHint>
            <Button
              type="button"
              disabled={changingPassword || !newPassword || !confirmPassword}
              onClick={() => void handleChangePassword()}
            >
              {changingPassword
                ? 'Updating…'
                : otpProof
                  ? 'Update password'
                  : 'Verify email & update'}
            </Button>
          </div>
          <OtpVerificationDialog
            open={otpOpen}
            onOpenChange={setOtpOpen}
            purpose="password_change"
            title="Verify to change password"
            onVerified={(proof) => {
              setOtpProof(proof);
              toast.success('Email verified — you can update your password now');
            }}
          />
        </ContentCard>
      ) : null}

      <ContentCard title="Payment details">
        <PaymentSettingsSection />
      </ContentCard>

      <ContentCard title="Delete account">
        <PrivacySection />
      </ContentCard>
    </div>
  );
}
