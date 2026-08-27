'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, Heart, Sparkles, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AppPage } from '@/components/app-page';
import { ContentCard } from '@/components/content-card';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FeatureGate } from '@/features/billing/components/feature-gate';
import { useEmployees } from '@/hooks/queries/use-employees';
import { useFeatureAccess } from '@/hooks/queries/use-feature-access';
import {
  useCreateShoutoutCategoryAdmin,
  useDeleteShoutoutCategoryAdmin,
} from '@/hooks/queries/use-shoutout-settings';
import {
  useCreateShoutout,
  useMyPointsBalance,
  useShoutoutCategories,
  useShoutouts,
} from '@/hooks/queries/use-shoutouts';
import { useUrlTab } from '@/hooks/use-url-tab';
import { apiClient, tenantPath } from '@/lib/api/client';
import { FeatureAccess } from '@/lib/constants/feature-access';
import { PAQ_POINTS_NAME } from '@/lib/constants/paq-points';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { useTenant } from '@/providers/tenant-provider';
import { getShoutoutsRewardsAccessState } from '../lib/shoutouts-rewards-access';
import { ShoutoutCard } from './shoutout-card';
import {
  ShoutoutComposer,
  type ShoutoutComposerHandle,
  type ShoutoutSubmitPayload,
} from './shoutout-composer';
import { ShoutoutTasksTab } from './shoutout-tasks-tab';

const RewardsPage = dynamic(
  () => import('@/features/rewards/components/rewards-page').then((m) => m.RewardsPage),
  { ssr: false },
);

function allowancePeriodLabel(period?: string): string {
  if (period === 'weekly') return 'weekly';
  if (period === 'quarterly') return 'quarterly';
  return 'monthly';
}

const SHOUTOUT_TABS = ['feed', 'tasks', 'redeem', 'rewards'] as const;

type ShoutoutsTab = 'feed' | 'tasks' | 'redeem';
type ShoutoutsUrlTab = (typeof SHOUTOUT_TABS)[number];

function isShoutoutsTab(tab: string | null): tab is ShoutoutsUrlTab {
  return SHOUTOUT_TABS.includes(tab as ShoutoutsUrlTab);
}

function ShoutoutsPageContent() {
  const [urlTab, setUrlTab] = useUrlTab(isShoutoutsTab, 'feed');
  const { tenant, tenantId } = useTenant();
  const queryClient = useQueryClient();
  const { hasFeature, featureGatingEnabled, isLoading: featureAccessLoading } = useFeatureAccess();
  const currentMemberId = tenant?.member?.id;
  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';
  const activeTab: ShoutoutsTab = urlTab === 'rewards' ? 'redeem' : urlTab;
  const {
    canAccessShoutouts,
    feedQueriesEnabled,
    rewardsCatalogPrefetchEnabled,
    showRewardsContent,
  } = getShoutoutsRewardsAccessState({
    activeTab,
    featureAccessLoading,
    featureGatingEnabled,
    hasFeature,
    integrationsFeature: FeatureAccess.INTEGRATIONS,
  });

  // Prefetch rewards catalog when component mounts
  useEffect(() => {
    if (tenantId && rewardsCatalogPrefetchEnabled) {
      void queryClient.prefetchQuery({
        queryKey: [...queryKeys.rewards.catalog, tenantId],
        queryFn: () => apiClient(tenantPath(tenantId, 'rewards/catalog')),
        staleTime: 60_000,
      });
    }
  }, [queryClient, rewardsCatalogPrefetchEnabled, tenantId]);

  const { data: employees = [] } = useEmployees({
    enabled: canAccessShoutouts && activeTab === 'feed',
  });
  const { data: categories = [] } = useShoutoutCategories({ enabled: feedQueriesEnabled });

  const employeeOptions = useMemo(
    () =>
      employees
        .filter((employee) => employee.id !== currentMemberId)
        .map((employee) => ({ id: employee.id, name: employee.name })),
    [employees, currentMemberId],
  );
  const categoryOptions = useMemo(
    () => categories.map((category) => ({ id: category.id, name: category.name })),
    [categories],
  );
  const { data: pointsBalance } = useMyPointsBalance({ enabled: canAccessShoutouts });
  const { data, isLoading, isError, error } = useShoutouts({ enabled: feedQueriesEnabled });
  const createShoutout = useCreateShoutout();

  const { data: tasks = [] } = useQuery<{ id: string; status: string }[]>({
    queryKey: ['shoutout-tasks', tenant?.id],
    queryFn: () =>
      apiClient<{ id: string; status: string }[]>(tenantPath(tenant?.id ?? '', 'rewards/tasks')),
    enabled: canAccessShoutouts && Boolean(tenant?.id),
    staleTime: 30_000,
  });

  const availableCount = tasks.filter(
    (task) => task.status === 'available' || task.status === 'rejected',
  ).length;

  const createCategory = useCreateShoutoutCategoryAdmin();
  const deleteCategory = useDeleteShoutoutCategoryAdmin();
  const [newCategoryName, setNewCategoryName] = useState('');
  const composerRef = useRef<ShoutoutComposerHandle>(null);

  const items = data?.records ?? data?.shoutouts ?? data?.data ?? data?.items ?? [];

  const handleCreate = async (payload: ShoutoutSubmitPayload) => {
    await createShoutout.mutateAsync({
      recipients: payload.recipients,
      message: payload.message,
      categoryIds: payload.categoryIds.length ? payload.categoryIds : undefined,
    });
    toast.success('Shoutout sent successfully!');
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await createCategory.mutateAsync({ name: newCategoryName.trim() });
      setNewCategoryName('');
      toast.success('Core value category added!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add core value');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteCategory.mutateAsync(id);
      toast.success('Core value category removed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove core value');
    }
  };

  if (isLoading) {
    return <LoadingBlock />;
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load shoutouts</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Something went wrong'}
        </AlertDescription>
      </Alert>
    );
  }

  const totalAllowance = pointsBalance?.monthlyAllowance ?? 0;
  const remainingAllowance = pointsBalance?.remainingAllowance ?? 0;
  const allowancePercent =
    totalAllowance > 0
      ? Math.min(100, Math.max(0, (remainingAllowance / totalAllowance) * 100))
      : 0;
  const periodLabel = allowancePeriodLabel(pointsBalance?.allowancePeriod);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        {pointsBalance ? (
          <div className="dashboard-soft-tile flex min-w-0 flex-col gap-3 rounded-[8px] px-4 py-3 sm:min-w-[320px] sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="dashboard-outline-label text-[11px] font-semibold uppercase">
                Available to give
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                {remainingAllowance.toLocaleString()}
                <span className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  {PAQ_POINTS_NAME}
                </span>
              </p>
            </div>
            <div className="min-w-0 text-left sm:text-right">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Redeemable balance
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                {pointsBalance.currentBalance.toLocaleString()} pts
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setUrlTab(value as ShoutoutsUrlTab)}
        className="space-y-5"
      >
        <div className="overflow-x-auto pb-1">
          <TabsList className="app-segmented-control gap-1">
            <TabsTrigger className="app-segmented-trigger !flex-none" value="feed">
              Shoutouts Feed
            </TabsTrigger>
            <TabsTrigger className="app-segmented-trigger !flex-none" value="tasks">
              Points Tasks
              {availableCount > 0 ? (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {availableCount}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger className="app-segmented-trigger !flex-none" value="redeem">
              Redeem Rewards
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="feed" className="mt-0 space-y-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
            <div className="space-y-5 lg:col-span-8">
              <ShoutoutComposer
                ref={composerRef}
                variant="feed"
                employees={employeeOptions}
                categories={categoryOptions}
                points={pointsBalance}
                onSubmit={handleCreate}
                isSubmitting={createShoutout.isPending}
              />

              <ContentCard
                title="Activity feed"
                action={
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {items.length} recognition(s)
                  </span>
                }
                bodyClassName="space-y-3 p-4"
              >
                {items.length === 0 ? (
                  <EmptyState
                    icon={Heart}
                    title="No shoutouts yet"
                    description="Be the first to recognize someone on your team."
                    className="min-h-[260px]"
                  />
                ) : (
                  items.map((shoutout) => (
                    <ShoutoutCard
                      key={shoutout.id}
                      shoutout={shoutout}
                      employees={employeeOptions}
                      categories={categoryOptions}
                    />
                  ))
                )}
              </ContentCard>
            </div>

            <div className="space-y-5 lg:col-span-4">
              {pointsBalance ? (
                <ContentCard title="Allowance overview" bodyClassName="space-y-4 p-5">
                  <div className="dashboard-soft-tile space-y-3 rounded-[8px] px-4 py-4">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-slate-500 dark:text-slate-400">
                        {periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)} give allowance
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {remainingAllowance} / {totalAllowance} pts left
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/70 dark:bg-slate-950/60">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-500"
                        style={{ width: `${allowancePercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="dashboard-soft-tile flex items-center justify-between gap-3 rounded-[8px] px-4 py-3">
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Lifetime earned
                      </p>
                    </div>
                    <p className="flex items-center gap-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                      <Coins className="size-4 text-primary" />
                      {pointsBalance.totalEarned.toLocaleString()}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => setUrlTab('redeem')}
                  >
                    Go to Rewards Catalog
                  </Button>
                </ContentCard>
              ) : null}

              <ContentCard title="Company core values" bodyClassName="space-y-4 p-5">
                {isAdmin ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add core value..."
                      className="text-sm placeholder:text-muted-foreground/75"
                      value={newCategoryName}
                      onChange={(event) => setNewCategoryName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void handleAddCategory();
                      }}
                    />
                    <Button
                      size="sm"
                      className="px-3 text-xs font-semibold"
                      onClick={() => void handleAddCategory()}
                      disabled={createCategory.isPending}
                    >
                      Add
                    </Button>
                  </div>
                ) : null}

                {categories.length === 0 ? (
                  <div className="dashboard-soft-tile rounded-[8px] border border-dashed border-[#d7e3f6] px-4 py-5 text-center dark:border-slate-700">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      No core values set up yet
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {categories.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-center justify-between rounded-[8px] border border-primary/10 bg-primary/5 text-sm font-medium text-primary dark:text-primary/80"
                      >
                        <button
                          type="button"
                          onClick={() => composerRef.current?.insertAtCursor(`#${category.name} `)}
                          className={cn(
                            'flex flex-1 items-center gap-1.5 py-2 pl-3 text-left transition-colors hover:bg-primary/10',
                            isAdmin ? 'pr-1' : 'pr-3',
                          )}
                        >
                          <Sparkles className="size-3.5 text-primary" />
                          {category.name}
                        </button>
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => void handleDeleteCategory(category.id)}
                            disabled={deleteCategory.isPending}
                            aria-label={`Remove ${category.name}`}
                            className="rounded-r-[8px] p-2 text-primary/70 transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                          >
                            <X className="size-3.5" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </ContentCard>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="redeem" className="mt-0 space-y-4">
          {featureAccessLoading ? (
            <LoadingBlock />
          ) : (
            <FeatureGate feature={FeatureAccess.INTEGRATIONS}>
              {showRewardsContent ? <RewardsPage isTab={true} /> : null}
            </FeatureGate>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-0">
          <ShoutoutTasksTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ShoutoutsPage() {
  return (
    <AppPage>
      <ShoutoutsPageContent />
    </AppPage>
  );
}
