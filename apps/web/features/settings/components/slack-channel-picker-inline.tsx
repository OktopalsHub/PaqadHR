'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { SearchSelect, type SearchSelectOption } from '@/components/search-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCreateSlackChannel,
  useSetupShoutoutChannel,
  useSlackChannels,
} from '@/hooks/queries/use-integrations';

const SLACK_CHANNEL_ID_PATTERN = /^[CG][A-Z0-9]+$/;

type SlackChannelPickerInlineProps = {
  integrationId: string;
  onSaved?: () => void;
  onCancel?: () => void;
  onReconnect?: () => void;
};

function formatChannelLabel(name: string, isPrivate?: boolean) {
  const label = name.startsWith('#') ? name : `#${name}`;
  return isPrivate ? `🔒 ${label}` : label;
}

function getExtraChannelOptions(search: string, channels: { id: string }[]): SearchSelectOption[] {
  const trimmed = search.trim().toUpperCase();
  if (!SLACK_CHANNEL_ID_PATTERN.test(trimmed)) {
    return [];
  }
  if (channels.some((channel) => channel.id === trimmed)) {
    return [];
  }
  return [{ value: trimmed, label: `Use channel ID: ${trimmed}` }];
}

export function SlackChannelPickerInline({
  integrationId,
  onSaved,
  onCancel,
  onReconnect,
}: SlackChannelPickerInlineProps) {
  const [channelId, setChannelId] = useState('');
  const [newChannelName, setNewChannelName] = useState('shoutouts');
  const {
    data: channels = [],
    isLoading,
    isError,
    isFetching,
    error,
    refetch,
  } = useSlackChannels(integrationId, true);
  const setupChannel = useSetupShoutoutChannel();
  const createChannel = useCreateSlackChannel();

  const channelOptions = useMemo<SearchSelectOption[]>(
    () =>
      channels.map((channel) => ({
        value: channel.id,
        label: formatChannelLabel(channel.name, channel.type === 'private'),
      })),
    [channels],
  );

  const listError = isError
    ? error instanceof Error
      ? error.message
      : 'Could not load Slack channels'
    : null;

  const saveChannel = async (id: string, name: string) => {
    const result = await setupChannel.mutateAsync({
      integrationId,
      platformChannelId: id,
      platformChannelName: formatChannelLabel(name),
    });

    if (result.testMessageSent) {
      toast.success('Channel saved and test message sent');
    } else if (result.testMessageError) {
      toast.warning(`Channel saved, but test message failed: ${result.testMessageError}`);
    } else {
      toast.success(result.message || 'Channel saved');
    }

    onSaved?.();
  };

  const handleSave = async () => {
    if (!channelId) {
      toast.error('Select a Slack channel');
      return;
    }
    const selectedChannel = channels.find((channel) => channel.id === channelId);
    const name = selectedChannel?.name ?? channelId;
    try {
      await saveChannel(channelId, name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save channel');
    }
  };

  const handleCreate = async () => {
    const name = newChannelName.trim();
    if (!name) {
      toast.error('Enter a channel name');
      return;
    }
    try {
      const created = await createChannel.mutateAsync({ integrationId, name });
      await saveChannel(created.id, created.name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create channel');
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading channels…</p>;
  }

  if (listError) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed p-4">
        <p className="text-sm text-destructive">{listError}</p>
        {onReconnect ? (
          <Button size="sm" variant="outline" onClick={onReconnect}>
            Reconnect
          </Button>
        ) : null}
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="space-y-4 rounded-lg border border-dashed p-4">
        <p className="text-sm text-muted-foreground">
          No channels available. Create a public channel or invite PaqadHR to an existing one in
          Slack.
        </p>
        <div className="space-y-2">
          <Label htmlFor="new-slack-channel">Create public channel</Label>
          <div className="flex gap-2">
            <Input
              id="new-slack-channel"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="shoutouts"
            />
            <Button
              disabled={createChannel.isPending || setupChannel.isPending}
              onClick={handleCreate}
            >
              {createChannel.isPending || setupChannel.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Create'
              )}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          For a private channel: open it in Slack, then run{' '}
          <span className="font-mono">/invite @PaqadHR</span> and refresh here.
        </p>
        {onCancel ? (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-dashed p-4">
      <div className="space-y-2">
        <Label htmlFor="slack-channel">Channel</Label>
        <SearchSelect
          options={channelOptions}
          value={channelId}
          onValueChange={setChannelId}
          placeholder="Select a channel"
          searchPlaceholder="Search channels or paste channel ID…"
          emptyMessage="No channels found."
          getExtraOptions={(search) => getExtraChannelOptions(search, channels)}
          footer={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {isFetching ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 size-4" />
              )}
              Refresh channels
            </Button>
          }
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!channelId || setupChannel.isPending} onClick={handleSave}>
          {setupChannel.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
          Save
        </Button>
        {onCancel ? (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}
