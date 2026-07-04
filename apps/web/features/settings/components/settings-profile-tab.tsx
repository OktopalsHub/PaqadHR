'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AvatarUpload } from '@/components/avatar-upload';
import { ContentCard } from '@/components/content-card';
import { LoadingBlock } from '@/components/loading-block';
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

export function SettingsProfileTab() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useMemberProfile();
  const updateProfile = useUpdateMemberProfile();
  const avatarUpload = useMemberAvatarUpload({ isSelf: true });

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.firstName?.trim() ?? '');
    setLastName(profile.lastName?.trim() ?? '');
    setPreferredName(profile.preferredName?.trim() ?? '');
    setAvatarUrl(profile.avatarUrl ?? null);
  }, [profile]);

  const name = memberFullName(profile, user?.name);
  const initials = memberInitials(profile, user?.name);

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

      <ContentCard
        title="Personal details"
        description="Update how your name appears across the workspace"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <SettingsFieldHint label="First name">
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </SettingsFieldHint>
          <SettingsFieldHint label="Last name">
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </SettingsFieldHint>
          <SettingsFieldHint
            label="Preferred name"
            hint="Optional display name used in shoutouts and greetings."
            className="sm:col-span-2"
          >
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

      <ContentCard title="Payment details" description="Bank account for receiving payroll">
        <PaymentSettingsSection />
      </ContentCard>

      <ContentCard title="Delete account" description="Permanently remove your Paqad account">
        <PrivacySection />
      </ContentCard>
    </div>
  );
}
