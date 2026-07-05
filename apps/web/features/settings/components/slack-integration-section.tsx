'use client';

import { Loader2 } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SlackIcon } from '@/components/icons/slack-icon';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  useConnectSlack,
  useDisconnectSlack,
  useShoutoutSlackStatus,
  useSlackChannels,
} from '@/hooks/queries/use-integrations';
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
  const disconnectSlack = useDisconnectSlack();
  const [pickerOpen, setPickerOpen] = useState(false);

  const integrationId = searchParams.get('integration_id') ?? status?.integrationId ?? undefined;
  const shouldAutoOpen = searchParams.get('slack_setup') === '1';
  const configuredChannelIds =
    status?.configuredChannels?.map((channel) => channel.platformChannelId) ?? [];
  const configuredChannelLabel = (() => {
    const names = status?.channelNames ?? (status?.channelName ? [status.channelName] : []);
    if (names.length === 0) return null;
    return names
      .map((name) => (name.startsWith('#') ? name : `#${name.replace(/^#/, '')}`))
      .join(', ');
  })();
  const activeIntegrationId = status?.integrationId ?? integrationId;
  const channelsQuery = useSlackChannels(
    activeIntegrationId,
    Boolean(isAdmin && activeIntegrationId && !isLoading),
  );
  const needsReconnect = Boolean(
    activeIntegrationId && !channelsQuery.isLoading && channelsQuery.isError,
  );
  const isConnected = Boolean(activeIntegrationId);

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

  useEffect(() => {
    if (status?.integrationId && !status.configured) {
      setPickerOpen(true);
    }
  }, [status?.integrationId, status?.configured]);

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

  const handleDisconnect = async () => {
    if (!status?.integrationId) return;
    try {
      const result = await disconnectSlack.mutateAsync(status.integrationId);
      setPickerOpen(false);
      toast.success(result.message || 'Slack disconnected');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect Slack');
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
            Posting to{' '}
            <span className="font-medium text-foreground">
              {configuredChannelLabel ?? status.channelName}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {!pickerOpen ? (
              <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
                Change channels
              </Button>
            ) : null}
            <SlackConnectionActions
              isConnected={isConnected}
              needsReconnect={needsReconnect}
              connectPending={connectSlack.isPending}
              disconnectPending={disconnectSlack.isPending}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
            />
          </div>
        </div>
      ) : isConnected ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {needsReconnect
              ? 'Slack connection failed. Reconnect to load channels.'
              : 'Connected. Choose a channel for shoutouts.'}
          </p>
          <SlackConnectionActions
            isConnected={isConnected}
            needsReconnect={needsReconnect}
            connectPending={connectSlack.isPending}
            disconnectPending={disconnectSlack.isPending}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Connect Slack to post shoutouts.</p>
          <SlackConnectionActions
            isConnected={isConnected}
            needsReconnect={needsReconnect}
            connectPending={connectSlack.isPending}
            disconnectPending={disconnectSlack.isPending}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        </div>
      )}

      {pickerOpen && activeIntegrationId ? (
        <SlackChannelPickerInline
          integrationId={activeIntegrationId}
          initialChannelIds={configuredChannelIds}
          onSaved={() => setPickerOpen(false)}
          onCancel={() => setPickerOpen(false)}
          onReconnect={needsReconnect ? handleConnect : undefined}
        />
      ) : null}

      {status?.integrationId && <SlackUserSyncSection integrationId={status.integrationId} />}
    </div>
  );
}

function SlackConnectionActions({
  isConnected,
  needsReconnect,
  connectPending,
  disconnectPending,
  onConnect,
  onDisconnect,
}: {
  isConnected: boolean;
  needsReconnect: boolean;
  connectPending: boolean;
  disconnectPending: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  if (!isConnected) {
    return (
      <Button
        size="sm"
        className={slackBrandButtonClass}
        disabled={connectPending}
        onClick={onConnect}
      >
        {connectPending ? (
          <Loader2 className="mr-1.5 size-4 animate-spin" />
        ) : (
          <SlackIcon className="mr-1.5 size-4" />
        )}
        Connect
      </Button>
    );
  }

  if (needsReconnect) {
    return (
      <>
        <Button size="sm" variant="outline" disabled={connectPending} onClick={onConnect}>
          {connectPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
          Reconnect
        </Button>
        <DisconnectSlackButton pending={disconnectPending} onDisconnect={onDisconnect} />
      </>
    );
  }

  return <DisconnectSlackButton pending={disconnectPending} onDisconnect={onDisconnect} />;
}

function DisconnectSlackButton({
  pending,
  onDisconnect,
}: {
  pending: boolean;
  onDisconnect: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : 'Disconnect'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect Slack?</AlertDialogTitle>
          <AlertDialogDescription>
            Shoutouts will stop posting to Slack until you connect again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onDisconnect}
          >
            Disconnect
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
