'use client';

import { AppPage } from '@/components/app-page';
import { ContentCard } from '@/components/content-card';
import { SlackIntegrationSection } from '@/features/settings/components/slack-integration-section';
import { useTenant } from '@/providers/tenant-provider';

export default function SlackIntegrationPage() {
  const { tenant } = useTenant();
  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';

  return (
    <AppPage className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-lg font-semibold">Slack</h1>
        <p className="text-sm text-muted-foreground">
          Connect Slack to post team shoutouts to a channel
        </p>
      </div>

      <ContentCard
        title="Shoutouts"
        description="Recognition posts from Paqad appear in your Slack workspace"
      >
        {isAdmin ? (
          <SlackIntegrationSection enableOAuth />
        ) : (
          <p className="text-sm text-muted-foreground">
            Ask a workspace admin to connect Slack for shoutouts.
          </p>
        )}
      </ContentCard>
    </AppPage>
  );
}
