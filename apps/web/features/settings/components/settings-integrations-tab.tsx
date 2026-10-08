'use client';

import { ContentCard } from '@/components/content-card';
import { AgentApprovalsSection } from '@/features/settings/components/agent-approvals-section';
import { ApiKeysSection } from '@/features/settings/components/api-keys-section';
import { SlackIntegrationSection } from '@/features/settings/components/slack-integration-section';

export function SettingsIntegrationsTab() {
  return (
    <div className="space-y-6">
      <ContentCard title="Slack">
        <SlackIntegrationSection />
      </ContentCard>
      <ContentCard title="API keys">
        <ApiKeysSection />
      </ContentCard>
      <ContentCard title="Agent approvals">
        <AgentApprovalsSection />
      </ContentCard>
    </div>
  );
}
