'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { SlackIcon } from '@/components/icons/slack-icon';
import { Button } from '@/components/ui/button';
import { useConnectSlack, useShoutoutSlackStatus } from '@/hooks/queries/use-integrations';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { useTenant } from '@/providers/tenant-provider';

export function SlackIntegrationSection() {
  const { tenant } = useTenant();
  const tenantHref = useTenantHref();
  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';
  const { data: status, isLoading } = useShoutoutSlackStatus();
  const connectSlack = useConnectSlack();

  if (!isAdmin) {
    return null;
  }

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

  if (status?.configured) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Shoutouts are posted to{' '}
          <span className="font-medium text-foreground">{status.channelName}</span> on Slack.
        </p>
        <Button size="sm" variant="outline" asChild>
          <Link href={setupHref}>Change channel</Link>
        </Button>
      </div>
    );
  }

  if (status?.integrationId) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Slack is connected. Choose a channel where shoutouts should be posted.
        </p>
        <Button size="sm" asChild>
          <Link href={setupHref}>Select shoutout channel</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Connect Slack so team shoutouts appear in your workspace channel.
      </p>
      <Button size="sm" disabled={connectSlack.isPending} onClick={handleConnect}>
        {connectSlack.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
        <SlackIcon className="mr-1 size-4" />
        Connect Slack
      </Button>
    </div>
  );
}
