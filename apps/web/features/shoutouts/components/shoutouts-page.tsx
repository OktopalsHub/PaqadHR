'use client';

import { Heart, Sparkles, Trophy, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppPage } from '@/components/app-page';
import { ContentCard } from '@/components/content-card';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
import { StatCard } from '@/components/stat-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useEmployees } from '@/hooks/queries/use-employees';
import { useShoutoutSlackStatus } from '@/hooks/queries/use-integrations';
import {
  useCreateShoutout,
  useMyPointsBalance,
  useShoutoutCategories,
  useShoutouts,
} from '@/hooks/queries/use-shoutouts';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { ApiError } from '@/lib/api/client';
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
  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';

  const { data: employees = [] } = useEmployees();
  const { data: categories = [] } = useShoutoutCategories();
  const { data: pointsBalance } = useMyPointsBalance();
  const { data: slackStatus, isLoading: slackStatusLoading } = useShoutoutSlackStatus();
  const { data, isLoading, isError, error } = useShoutouts();
  const createShoutout = useCreateShoutout();

  const items = data?.records ?? data?.shoutouts ?? data?.data ?? data?.items ?? [];
  const slackConfigured = slackStatus?.configured ?? false;

  const totalPointsGiven = useMemo(
    () => items.reduce((sum, item) => sum + item.totalPoints, 0),
    [items],
  );

  useEffect(() => {
    if (categories[0] && !categoryId) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  const showSlackBlockedToast = () => {
    if (isAdmin) {
      toast.error('Connect Slack in Settings to enable shoutouts', {
        action: {
          label: 'Open Settings',
          onClick: () => {
            window.location.href = tenantHref('settings');
          },
        },
      });
      return;
    }

    toast.error('Shoutouts are disabled until an admin connects Slack in Settings.');
  };

  const handleCreate = async () => {
    if (!slackConfigured) {
      showSlackBlockedToast();
      return;
    }

    if (!recipientId || !message.trim()) {
      toast.error('Select a recipient and write a message');
      return;
    }
    const pointsNum = Number(points) || 10;
    if (pointsBalance && pointsNum > pointsBalance.remainingAllowance) {
      toast.error("You don't have enough points left this month");
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
      if (err instanceof ApiError && err.code === 'SLACK_NOT_CONFIGURED') {
        showSlackBlockedToast();
        return;
      }
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

  const composerDisabledHint = isAdmin
    ? 'Connect Slack in Settings and choose a channel before sending shoutouts.'
    : 'Shoutouts are disabled until an admin connects Slack in Settings.';

  return (
    <AppPage>
      {!slackConfigured ? (
        <Alert>
          <AlertTitle>Slack not connected</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{composerDisabledHint}</p>
            {isAdmin ? (
              <Link href={tenantHref('settings')} className="text-sm font-medium underline">
                Go to Settings
              </Link>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Shoutouts"
          value={items.length}
          hint="All time in workspace"
          icon={Sparkles}
        />
        <StatCard
          label="Points shared"
          value={totalPointsGiven}
          hint="Across the feed"
          icon={Trophy}
        />
        <StatCard
          label="Given this month"
          value={pointsBalance?.monthlyGiven ?? '—'}
          hint={pointsBalance ? `${pointsBalance.remainingAllowance} left to give` : undefined}
          icon={Heart}
        />
        <StatCard
          label="Core values"
          value={categories.length}
          hint="Active categories"
          icon={Users}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <ContentCard
          title="Team feed"
          description="Recent recognition across your workspace"
          bodyClassName="space-y-3 p-3 sm:p-4"
        >
          {items.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="No shoutouts yet"
              description="Be the first to recognize someone on your team."
            />
          ) : (
            items.map((shoutout) => <ShoutoutCard key={shoutout.id} shoutout={shoutout} />)
          )}
        </ContentCard>

        <aside className="space-y-4 lg:sticky lg:top-16 lg:self-start">
          <ShoutoutComposer
            employees={employees.map((e) => ({ id: e.id, name: e.name }))}
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
            disabled={!slackConfigured}
            disabledHint={!slackConfigured ? composerDisabledHint : undefined}
          />

          {categories.length > 0 ? (
            <div className="app-card rounded-xl p-4">
              <h3 className="text-sm font-semibold">Your values</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Tag shoutouts to reinforce what matters most.
              </p>
              <ul className="mt-3 space-y-2">
                {categories.map((category) => (
                  <li key={category.id} className="flex items-center gap-2 text-sm">
                    <span
                      className="size-2 shrink-0 rounded-full bg-primary"
                      style={category.color ? { backgroundColor: category.color } : undefined}
                    />
                    {category.name}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </AppPage>
  );
}
