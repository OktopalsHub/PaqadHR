'use client';

import { ContentCard } from '@/components/content-card';
import { SlackIntegrationSection } from '@/features/settings/components/slack-integration-section';

export function SettingsIntegrationsTab() {
  return (
    <div className="space-y-6">
      <ContentCard title="Slack" description="Post shoutouts to a channel">
        <SlackIntegrationSection />
      </ContentCard>
    </div>
  );
}
