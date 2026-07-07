'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ContentCard } from '@/components/content-card';
import { LoadingBlock } from '@/components/loading-block';
import { Input } from '@/components/ui/input';
import {
  SettingsFieldHint,
  SettingsSwitchRow,
} from '@/features/settings/components/settings-field-hint';
import { SettingsFormActions } from '@/features/settings/components/settings-form-actions';
import { usePatchTenantSettings, useTenantSettings } from '@/hooks/queries/use-tenant-settings';

export function SettingsNotificationsTab() {
  const { data: settings, isLoading } = useTenantSettings();
  const patchSettings = usePatchTenantSettings();

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [slackNotifications, setSlackNotifications] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    const notifications = settings?.settings?.notifications;
    if (!notifications) return;
    setEmailNotifications(notifications.emailNotifications ?? true);
    setSlackNotifications(notifications.slackNotifications ?? false);
    setWebhookUrl(notifications.webhookUrl ?? '');
  }, [settings]);

  if (isLoading) return <LoadingBlock />;

  const save = async () => {
    try {
      await patchSettings.mutateAsync({
        notifications: {
          emailNotifications,
          slackNotifications,
          webhookUrl: webhookUrl.trim() || undefined,
        },
      });
      toast.success('Notification settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  return (
    <div>
      <ContentCard title="Notifications" description="How your workspace sends alerts">
        <div className="space-y-4">
          <SettingsSwitchRow
            id="email-notifications"
            label="Email notifications"
            hint="Send important workspace updates and reminders by email."
            checked={emailNotifications}
            onCheckedChange={setEmailNotifications}
          />
          <SettingsSwitchRow
            id="slack-notifications"
            label="Slack notifications"
            hint="Requires Slack under Settings → Integrations."
            checked={slackNotifications}
            onCheckedChange={setSlackNotifications}
          />
          <SettingsFieldHint
            label="Webhook URL"
            hint="Optional URL for delivering notifications to a custom endpoint or Slack incoming webhook."
          >
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
            />
          </SettingsFieldHint>
          <SettingsFormActions onSave={save} isPending={patchSettings.isPending} />
        </div>
      </ContentCard>
    </div>
  );
}
