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
      toast.error(err instanceof Error ? err.message : 'Failed to connect Slack');
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      {status?.configured ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Posting to <span className="font-medium text-foreground">{status.channelName}</span>
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link href={setupHref}>Change channel</Link>
          </Button>
        </div>
      ) : status?.integrationId ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Connected. Choose a channel for shoutouts.</p>
          <Button size="sm" className={slackBrandButtonClass} asChild>
            <Link href={setupHref}>
              <SlackIcon className="mr-1.5 size-4" />
              Select channel
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Connect Slack to post shoutouts.</p>
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
      )}

      {status?.integrationId && <SlackUserSyncSection integrationId={status.integrationId} />}
    </div>
  );
}
