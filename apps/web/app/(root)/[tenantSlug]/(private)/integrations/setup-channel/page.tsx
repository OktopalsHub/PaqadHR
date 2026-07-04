'use client';

import { Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { AppPage } from '@/components/app-page';
import { ContentCard } from '@/components/content-card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSetupShoutoutChannel, useSlackChannels } from '@/hooks/queries/use-integrations';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';

export default function SetupChannelPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantHref = useTenantHref();
  const integrationsHref = tenantHref('settings?tab=integrations');
  const integrationId = searchParams.get('integration_id') ?? '';
  const [channelId, setChannelId] = useState('');
  const { data: channels = [], isLoading } = useSlackChannels(integrationId || undefined);
  const setupChannel = useSetupShoutoutChannel();

  const selectedChannel = channels.find((channel) => channel.id === channelId);

  const handleSave = async () => {
    if (!integrationId || !selectedChannel) {
      toast.error('Select a Slack channel');
      return;
    }

    try {
      const result = await setupChannel.mutateAsync({
        integrationId,
        platformChannelId: selectedChannel.id,
        platformChannelName: selectedChannel.name.startsWith('#')
          ? selectedChannel.name
          : `#${selectedChannel.name}`,
      });

      if (result.testMessageSent) {
        toast.success('Channel saved and test message sent to Slack');
      } else if (result.testMessageError) {
        toast.warning(`Channel saved, but test message failed: ${result.testMessageError}`);
      } else {
        toast.success(result.message || 'Channel configured');
      }

      router.push(integrationsHref);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save channel');
    }
  };

  if (!integrationId) {
    return (
      <AppPage>
        <ContentCard title="Slack channel" description="Missing integration">
          <p className="text-sm text-muted-foreground">
            Connect Slack from Settings → Integrations, then pick a channel.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => router.push(integrationsHref)}>
            Back
          </Button>
        </ContentCard>
      </AppPage>
    );
  }

  return (
    <AppPage>
      <ContentCard title="Slack channel" description="Shoutouts post here">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading channels…</p>
        ) : channels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No channels found. Invite the PaqadHR bot to the channel you want.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="slack-channel">Channel</Label>
              <Select value={channelId} onValueChange={setChannelId}>
                <SelectTrigger id="slack-channel">
                  <SelectValue placeholder="Select a channel" />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.name.startsWith('#') ? channel.name : `#${channel.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!channelId || setupChannel.isPending} onClick={handleSave}>
                {setupChannel.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                Save
              </Button>
              <Button variant="outline" onClick={() => router.push(integrationsHref)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </ContentCard>
    </AppPage>
  );
}
