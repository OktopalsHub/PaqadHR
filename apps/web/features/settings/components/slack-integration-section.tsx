'use client';

import { Loader2 } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SlackIcon } from '@/components/icons/slack-icon';
import { Button } from '@/components/ui/button';
import { useConnectSlack, useShoutoutSlackStatus } from '@/hooks/queries/use-integrations';
import { useTenant } from '@/providers/tenant-provider';
import { SlackChannelPickerInline } from './slack-channel-picker-inline';
import { SlackUserSyncSection } from './slack-user-sync-section';

const slackBrandButtonClass =
  'bg-[#4A154B] text-white hover:bg-[#611f69] hover:text-white border-transparent shadow-sm';

export function SlackIntegrationSection() {
  const { tenant } = useTenant();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';
  const { data: status, isLoading } = useShoutoutSlackStatus();
  const connectSlack = useConnectSlack();
  const [pickerOpen, setPickerOpen] = useState(false);

  const integrationId = searchParams.get('integration_id') ?? status?.integrationId ?? undefined;
  const shouldAutoOpen = searchParams.get('slack_setup') === '1';

  useEffect(() => {
    if (shouldAutoOpen && integrationId) {
      setPickerOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('slack_setup');
      params.delete('integration_id');
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [shouldAutoOpen, integrationId, pathname, router, searchParams]);

  if (!isAdmin) {
    return null;
  }

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

  const activeIntegrationId = status?.integrationId ?? integrationId;

  return (
    <div className="space-y-6">
      {status?.configured ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Posting to <span className="font-medium text-foreground">{status.channelName}</span>
          </p>
          {!pickerOpen ? (
            <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
              Change channel
            </Button>
          ) : null}
        </div>
      ) : status?.integrationId ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connected. Choose a channel for shoutouts.
          </p>
          {!pickerOpen ? (
            <Button size="sm" className={slackBrandButtonClass} onClick={() => setPickerOpen(true)}>
              <SlackIcon className="mr-1.5 size-4" />
              Select channel
            </Button>
          ) : null}
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

      {pickerOpen && activeIntegrationId ? (
        <SlackChannelPickerInline
          integrationId={activeIntegrationId}
          onSaved={() => setPickerOpen(false)}
          onCancel={() => setPickerOpen(false)}
          onReconnect={handleConnect}
        />
      ) : null}

      {status?.integrationId && <SlackUserSyncSection integrationId={status.integrationId} />}
    </div>
  );
}
