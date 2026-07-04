'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { SlackIcon } from '@/components/icons/slack-icon';
import { Button } from '@/components/ui/button';
import { useConnectSlack, useShoutoutSlackStatus } from '@/hooks/queries/use-integrations';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { useTenant } from '@/providers/tenant-provider';
import { SlackUserSyncSection } from './slack-user-sync-section';

const slackBrandButtonClass =
  'bg-[#4A154B] text-white hover:bg-[#611f69] hover:text-white border-transparent shadow-sm';

type SlackIntegrationSectionProps = {
  /** When true, Connect starts OAuth. When false, navigates to the Slack integrations page. */
  enableOAuth?: boolean;
};

export function SlackIntegrationSection({ enableOAuth = false }: SlackIntegrationSectionProps) {
  const { tenant } = useTenant();
  const tenantHref = useTenantHref();
  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';
  const { data: status, isLoading } = useShoutoutSlackStatus();
  const connectSlack = useConnectSlack();

  if (!isAdmin) {
    return null;
  }

  const slackPageHref = tenantHref('integrations/slack');
  const setupHref = status?.integrationId
    ? tenantHref(`integrations/setup-channel?integration_id=${status.integrationId}&platform=slack`)
    : tenantHref('integrations/setup-channel');

  const handleConnect = async () => {
    try {
      await connectSlack.mutateAsync();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start Slack connection');
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading Slack integration…</p>;
  }

  return (
    <div className="space-y-6">
      {status?.configured ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Shoutouts are posted to{' '}
            <span className="font-medium text-foreground">{status.channelName}</span> on Slack.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link href={setupHref}>Change channel</Link>
          </Button>
        </div>
      ) : status?.integrationId ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Slack is connected. Choose a channel where shoutouts should be posted.
          </p>
          <Button size="sm" className={slackBrandButtonClass} asChild>
            <Link href={setupHref}>
              <SlackIcon className="mr-1.5 size-4" />
              Select shoutout channel
            </Link>
          </Button>
        </div>
      ) : enableOAuth ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect Slack so team shoutouts appear in your workspace channel.
          </p>
          <Button
            size="sm"
            className={slackBrandButtonClass}
            disabled={connectSlack.isPending}
            onClick={handleConnect}
          >
            {connectSlack.isPending ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <SlackIcon className="mr-1.5 size-4" />
            )}
            Add to Slack
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect Slack so team shoutouts appear in your workspace channel.
          </p>
          <Button size="sm" className={slackBrandButtonClass} asChild>
            <Link href={slackPageHref}>
              <SlackIcon className="mr-1.5 size-4" />
              Connect Slack
            </Link>
          </Button>
        </div>
      )}

      {status?.integrationId && <SlackUserSyncSection integrationId={status.integrationId} />}
    </div>
  );
}
