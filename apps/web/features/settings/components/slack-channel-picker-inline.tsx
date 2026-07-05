'use client';

import { Loader2, Lock, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  useCreateSlackChannel,
  useSetupShoutoutChannels,
  useSlackChannels,
} from '@/hooks/queries/use-integrations';
import type { ShoutoutChannelSetupResult } from '@/lib/api/integrations';
import { cn } from '@/lib/utils';

const SLACK_CHANNEL_ID_PATTERN = /^[CG][A-Z0-9]+$/;

type SlackChannelPickerInlineProps = {
  integrationId: string;
  initialChannelIds?: string[];
  onSaved?: () => void;
  onCancel?: () => void;
  onReconnect?: () => void;
};

function formatChannelLabel(name: string, isPrivate?: boolean) {
  const label = name.startsWith('#') ? name : `#${name}`;
  return isPrivate ? label : label;
}

function showSaveResultToast(result: {
  allTestsPassed: boolean;
  inviteRequired: string[];
  channels: ShoutoutChannelSetupResult[];
}) {
  if (result.allTestsPassed) {
    toast.success('Channels saved and test messages sent');
    return;
  }

  if (result.inviteRequired.length > 0) {
    toast.warning(
      `Channels saved. Invite PaqadHR to: ${result.inviteRequired.join(', ')}. In Slack, open each channel and run /invite @PaqadHR, then refresh.`,
      { duration: 10_000 },
    );
    return;
  }

  const failed = result.channels.filter((channel) => !channel.testMessageSent);
  if (failed.length > 0) {
    toast.warning(
      `Channels saved, but some test messages failed: ${failed.map((channel) => channel.platformChannelName).join(', ')}`,
    );
    return;
  }

  toast.success('Channels saved');
}

export function SlackChannelPickerInline({
  integrationId,
  initialChannelIds = [],
  onSaved,
  onCancel,
  onReconnect,
}: SlackChannelPickerInlineProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialChannelIds);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [newChannelName, setNewChannelName] = useState('shoutouts');
  const {
    data: channels = [],
    isLoading,
    isError,
    isFetching,
    error,
    refetch,
  } = useSlackChannels(integrationId, true);
  const setupChannels = useSetupShoutoutChannels();
  const createChannel = useCreateSlackChannel();

  useEffect(() => {
    setSelectedIds(initialChannelIds);
  }, [initialChannelIds]);

  const channelById = useMemo(
    () => new Map(channels.map((channel) => [channel.id, channel])),
    [channels],
  );

  const visibleChannels = useMemo(() => {
    const trimmed = search.trim().toUpperCase();
    const extra =
      SLACK_CHANNEL_ID_PATTERN.test(trimmed) && !channelById.has(trimmed)
        ? [{ id: trimmed, name: trimmed, type: 'public' as const }]
        : [];
    return [...channels, ...extra];
  }, [channelById, channels, search]);

  const listError = isError
    ? error instanceof Error
      ? error.message
      : 'Could not load Slack channels'
    : null;

  const toggleChannel = (channelId: string) => {
    setSelectedIds((current) =>
      current.includes(channelId)
        ? current.filter((id) => id !== channelId)
        : [...current, channelId],
    );
  };

  const saveChannels = async (ids: string[]) => {
    if (ids.length === 0) {
      toast.error('Select at least one Slack channel');
      return;
    }

    const payload = ids.map((id) => {
      const channel = channelById.get(id);
      const name = channel?.name ?? id;
      return {
        platformChannelId: id,
        platformChannelName: formatChannelLabel(name, channel?.type === 'private'),
      };
    });

    const result = await setupChannels.mutateAsync({ integrationId, channels: payload });
    showSaveResultToast(result);
    onSaved?.();
  };

  const handleSave = async () => {
    try {
      await saveChannels(selectedIds);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save channels');
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
      const nextIds = [...new Set([...selectedIds, created.id])];
      setSelectedIds(nextIds);
      await saveChannels(nextIds);
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
              disabled={createChannel.isPending || setupChannels.isPending}
              onClick={handleCreate}
            >
              {createChannel.isPending || setupChannels.isPending ? (
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
      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map((id) => {
            const channel = channelById.get(id);
            const label = channel
              ? formatChannelLabel(channel.name, channel.type === 'private')
              : id;
            return (
              <Badge key={id} variant="secondary" className="gap-1 pr-1">
                {channel?.type === 'private' ? <Lock className="size-3" /> : null}
                {label}
                <button
                  type="button"
                  className="ml-1 rounded-sm px-1 text-muted-foreground hover:text-foreground"
                  onClick={() => toggleChannel(id)}
                  aria-label={`Remove ${label}`}
                >
                  ×
                </button>
              </Badge>
            );
          })}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Channels</Label>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start font-normal">
              {selectedIds.length > 0
                ? `${selectedIds.length} channel${selectedIds.length === 1 ? '' : 's'} selected`
                : 'Select channels'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search channels or paste channel ID…"
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                <CommandEmpty>No channels found.</CommandEmpty>
                <CommandGroup>
                  {visibleChannels
                    .filter((channel) => {
                      const query = search.trim().toLowerCase();
                      if (!query) return true;
                      return (
                        channel.name.toLowerCase().includes(query) ||
                        channel.id.toLowerCase().includes(query)
                      );
                    })
                    .map((channel) => {
                      const checked = selectedIds.includes(channel.id);
                      const label = formatChannelLabel(channel.name, channel.type === 'private');
                      return (
                        <CommandItem
                          key={channel.id}
                          value={channel.id}
                          onSelect={() => toggleChannel(channel.id)}
                          className="gap-2"
                        >
                          <Checkbox checked={checked} className="pointer-events-none" />
                          {channel.type === 'private' ? (
                            <Lock className="size-3.5 shrink-0 text-muted-foreground" />
                          ) : null}
                          <span className="truncate">{label}</span>
                        </CommandItem>
                      );
                    })}
                </CommandGroup>
              </CommandList>
              <div className="border-t p-1">
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
              </div>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className={cn('flex flex-wrap gap-2')}>
        <Button disabled={selectedIds.length === 0 || setupChannels.isPending} onClick={handleSave}>
          {setupChannels.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
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
