'use client';

import { Check, Heart, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AppPage } from '@/components/app-page';
import { EmptyState } from '@/components/empty-state';
import { SlackIcon } from '@/components/icons/slack-icon';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DemoWindowChrome } from '@/features/home/components/product-demo/demo-window-chrome';
import { settingsTabHref } from '@/features/settings/lib/settings-tabs';
import { useEmployees } from '@/hooks/queries/use-employees';
import { useConnectSlack, useShoutoutSlackStatus } from '@/hooks/queries/use-integrations';
import {
  useCreateShoutout,
  useMyPointsBalance,
  useShoutoutCategories,
  useShoutouts,
} from '@/hooks/queries/use-shoutouts';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { PAQ_POINTS_NAME } from '@/lib/constants/paq-points';
import { cn } from '@/lib/utils';
import { useTenant } from '@/providers/tenant-provider';
import { ShoutoutCard } from './shoutout-card';
import { ShoutoutComposer } from './shoutout-composer';

export function ShoutoutsPage() {
  const [message, setMessage] = useState('');
  const [points, setPoints] = useState('10');
  const [recipientId, setRecipientId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const { tenant } = useTenant();
  const tenantHref = useTenantHref();
  const currentMemberId = tenant?.member?.id;
  const settingsBase = tenantHref('settings');
  const shoutoutsSettingsLink = settingsTabHref(settingsBase, 'shoutouts');

  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';

  const { data: employees = [] } = useEmployees();
  const { data: categories = [] } = useShoutoutCategories();
  const { data: pointsBalance } = useMyPointsBalance();
  const { data: slackStatus, isLoading: slackStatusLoading } = useShoutoutSlackStatus();
  const connectSlack = useConnectSlack();
  const { data, isLoading, isError, error } = useShoutouts();
  const createShoutout = useCreateShoutout();

  const items = data?.records ?? data?.shoutouts ?? data?.data ?? data?.items ?? [];
  const slackConfigured = slackStatus?.configured ?? false;

  const slackStatusLine = slackConfigured
    ? `Slack connected · posts to ${slackStatus?.channelName ? `#${slackStatus.channelName}` : 'your channel'}`
    : undefined;

  useEffect(() => {
    if (categories[0] && !categoryId) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  const handleConnectSlack = async () => {
    try {
      await connectSlack.mutateAsync();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start Slack connection');
    }
  };

  const handleCreate = async () => {
    if (!recipientId || !message.trim()) {
      toast.error('Select a recipient and write a message');
      return;
    }
    const pointsNum = Number(points) || 10;
    if (pointsBalance && pointsNum > pointsBalance.remainingAllowance) {
      toast.error(`You don't have enough ${PAQ_POINTS_NAME.toLowerCase()} left this month`);
      return;
    }
    try {
      await createShoutout.mutateAsync({
        recipientIds: [recipientId],
        pointsPerRecipient: pointsNum,
        message: message.trim(),
        categoryIds: categoryId ? [categoryId] : undefined,
      });
      setMessage('');
      setRecipientId('');
      toast.success('Shoutout sent');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send');
    }
  };

  if (isLoading || slackStatusLoading) {
    return (
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  if (isError) {
    return (
      <AppPage>
        <Alert variant="destructive">
          <AlertTitle>Unable to load shoutouts</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Something went wrong'}
          </AlertDescription>
        </Alert>
      </AppPage>
    );
  }

  return (
    <AppPage className="max-w-7xl mx-auto w-full space-y-8 py-4">
      {/* 2-Column Landing Feature style Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Wording from Landing Page */}
        <div className="lg:col-span-4 space-y-6">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              Culture
            </span>

            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Recognition built into daily work
            </h1>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Shoutouts, leave visibility, and team calendars keep people connected without another
              Slack bot.
            </p>
          </div>

          {/* Highlights checklist */}
          <ul className="space-y-3">
            <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Check className="size-3" />
              </span>
              <span className="font-medium text-foreground">Shoutout feed</span>
            </li>
            <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Link
                href={tenantHref('leaves')}
                className="flex items-center gap-2.5 hover:underline group"
              >
                <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-primary group-hover:bg-primary/20">
                  <Check className="size-3" />
                </span>
                <span className="font-medium text-foreground">Leave calendar</span>
                <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  (view page →)
                </span>
              </Link>
            </li>
            <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Check className="size-3" />
              </span>
              <span className="font-medium text-foreground">Team shoutouts</span>
            </li>
          </ul>

          {/* Admin category setup notification / explanation */}
          <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="size-4 text-primary" />
              <h4 className="text-xs font-semibold uppercase tracking-wider">
                About Categories & Values
              </h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Categories represent your company's core values (such as Integrity, Innovation, or
              Teamwork). Tagging a shoutout highlights how team members live these values daily.
            </p>
            {categories.length === 0 ? (
              <div className="rounded-lg border border-dashed border-amber-200 dark:border-amber-900/40 p-3 bg-amber-50/20 dark:bg-amber-950/10 text-center space-y-2">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-400">
                  No core values set up yet
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Without categories, team members won't be able to align their recognition with
                  company values.
                </p>
                {isAdmin ? (
                  <Button size="sm" variant="outline" className="w-full text-xs" asChild>
                    <Link href={shoutoutsSettingsLink}>Configure Core Values</Link>
                  </Button>
                ) : (
                  <p className="text-[10px] text-muted-foreground italic">
                    Ask a workspace administrator to create shoutout categories in settings.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Right Side: Interactive Browser Chrome with App content */}
        <div className="lg:col-span-8">
          <DemoWindowChrome
            url={`app.paqad.com/${tenant?.slug || 'acme-hr'}`}
            className="shadow-2xl shadow-black/10 dark:shadow-white/5 border-border/80 bg-background"
          >
            <div className="p-4 md:p-6 space-y-6">
              {/* Slack Connection Alert/Indicator inside Chrome */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-dashed bg-muted/30">
                <div className="space-y-1">
                  <p className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <span
                      className={cn(
                        'size-2 rounded-full',
                        slackConfigured ? 'bg-green-500 animate-pulse' : 'bg-amber-500',
                      )}
                    />
                    {slackConfigured ? 'Slack Connected' : 'Slack Not Connected'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {slackStatusLine ||
                      'Connect Slack to notify team members when they receive a shoutout.'}
                  </p>
                </div>
                {!slackConfigured && isAdmin ? (
                  <Button
                    size="sm"
                    className="h-8 text-xs shrink-0"
                    disabled={connectSlack.isPending}
                    onClick={handleConnectSlack}
                  >
                    {connectSlack.isPending ? (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : (
                      <SlackIcon className="mr-1 size-3" />
                    )}
                    Connect Slack
                  </Button>
                ) : null}
              </div>

              {/* Composer */}
              <ShoutoutComposer
                variant="feed"
                employees={employees
                  .filter((e) => e.id !== currentMemberId)
                  .map((e) => ({ id: e.id, name: e.name }))}
                categories={categories}
                points={pointsBalance}
                recipientId={recipientId}
                onRecipientChange={setRecipientId}
                categoryId={categoryId}
                onCategoryChange={setCategoryId}
                pointsValue={points}
                onPointsChange={setPoints}
                message={message}
                onMessageChange={setMessage}
                onSubmit={handleCreate}
                isSubmitting={createShoutout.isPending}
              />

              {/* Activity Feed inside Chrome */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Activity Feed
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {items.length} recognition(s)
                  </span>
                </div>

                <div className="space-y-3">
                  {items.length === 0 ? (
                    <EmptyState
                      icon={Heart}
                      title="No shoutouts yet"
                      description="Be the first to recognize someone on your team."
                    />
                  ) : (
                    items.map((shoutout) => <ShoutoutCard key={shoutout.id} shoutout={shoutout} />)
                  )}
                </div>
              </div>
            </div>
          </DemoWindowChrome>
        </div>
      </div>
    </AppPage>
  );
}
