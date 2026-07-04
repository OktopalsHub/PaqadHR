'use client';

import { useQuery } from '@tanstack/react-query';
import { Coins, Heart, Sparkles, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AppPage } from '@/components/app-page';
import { ContentCard } from '@/components/content-card';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RewardsPage } from '@/features/rewards/components/rewards-page';
import { useEmployees } from '@/hooks/queries/use-employees';
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
import { apiClient, tenantPath } from '@/lib/api/client';
import { PAQ_POINTS_NAME } from '@/lib/constants/paq-points';
import { useTenant } from '@/providers/tenant-provider';
import { ShoutoutCard } from './shoutout-card';
import { ShoutoutComposer } from './shoutout-composer';
import { ShoutoutTasksTab } from './shoutout-tasks-tab';

function ShoutoutsPageContent() {
  const [message, setMessage] = useState('');
  const [points, setPoints] = useState('10');
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState('');

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = searchParams.get('tab') || 'feed';

  const setTab = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const { tenant } = useTenant();
  const currentMemberId = tenant?.member?.id;

  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';

  const { data: employees = [] } = useEmployees();
  const { data: categories = [] } = useShoutoutCategories();
  const { data: pointsBalance } = useMyPointsBalance();
  const { data, isLoading, isError, error } = useShoutouts();
  const createShoutout = useCreateShoutout();

  const { data: tasks = [] } = useQuery<{ id: string; status: string }[]>({
    queryKey: ['shoutout-tasks', tenant?.id],
    queryFn: () =>
      apiClient<{ id: string; status: string }[]>(tenantPath(tenant?.id ?? '', 'rewards/tasks')),
    enabled: Boolean(tenant?.id),
  });

  const availableCount = tasks.filter(
    (t) => t.status === 'available' || t.status === 'rejected',
  ).length;

  const createCategory = useCreateShoutoutCategoryAdmin();
  const deleteCategory = useDeleteShoutoutCategoryAdmin();
  const [newCategoryName, setNewCategoryName] = useState('');

  const items = data?.records ?? data?.shoutouts ?? data?.data ?? data?.items ?? [];

  useEffect(() => {
    if (categories[0] && !categoryId) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  const handleCreate = async () => {
    if (recipientIds.length === 0 || !message.trim()) {
      toast.error('Select at least one recipient and write a message');
      return;
    }
    const pointsNum = Number(points) || 10;
    const totalPointsNeeded = pointsNum * recipientIds.length;
    if (pointsBalance && totalPointsNeeded > pointsBalance.remainingAllowance) {
      toast.error(
        `You don't have enough points left. Needed: ${totalPointsNeeded}, remaining: ${pointsBalance.remainingAllowance}`,
      );
      return;
    }
    try {
      await createShoutout.mutateAsync({
        recipientIds,
        pointsPerRecipient: pointsNum,
        message: message.trim(),
        categoryIds: categoryId ? [categoryId] : undefined,
      });
      setMessage('');
      setRecipientIds([]);
      toast.success('Shoutout sent successfully!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send');
    }
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

  const totalAllowance = pointsBalance?.monthlyAllowance ?? 100;
  const remainingAllowance = pointsBalance?.remainingAllowance ?? 100;
  const allowancePercent = Math.min(100, Math.max(0, (remainingAllowance / totalAllowance) * 100));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-1.5">
          <p className="dashboard-outline-label text-[11px] font-semibold uppercase">
            Culture & rewards
          </p>
          <h1 className="text-[30px] font-semibold tracking-[-0.035em] text-slate-950 dark:text-slate-50">
            Shoutouts & Recognition
          </h1>
          <p className="max-w-2xl text-sm font-medium text-slate-600 dark:text-slate-400">
            Appreciate your colleagues, earn points checklist rewards, and redeem vouchers
          </p>
        </div>

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

      <Tabs value={activeTab} onValueChange={setTab} className="space-y-5">
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto min-w-max items-center justify-start gap-1 rounded-[8px] border border-slate-100 bg-white p-1 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] dark:border-slate-800 dark:bg-slate-950/75 dark:shadow-none">
            <TabsTrigger
              className="!flex-none rounded-[8px] px-5 py-2 text-sm font-medium text-slate-500 transition-colors data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:bg-slate-50 data-[state=active]:font-semibold data-[state=active]:text-slate-800 data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-700 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-slate-100 dark:data-[state=active]:shadow-none"
              value="feed"
            >
              Shoutouts Feed
            </TabsTrigger>
            <TabsTrigger
              className="!flex-none rounded-[8px] px-5 py-2 text-sm font-medium text-slate-500 transition-colors data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:bg-slate-50 data-[state=active]:font-semibold data-[state=active]:text-slate-800 data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-700 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-slate-100 dark:data-[state=active]:shadow-none"
              value="tasks"
            >
              Points Tasks
              {availableCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {availableCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              className="!flex-none rounded-[8px] px-5 py-2 text-sm font-medium text-slate-500 transition-colors data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:bg-slate-50 data-[state=active]:font-semibold data-[state=active]:text-slate-800 data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-700 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-slate-100 dark:data-[state=active]:shadow-none"
              value="redeem"
            >
              Redeem Rewards
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="feed" className="mt-0 space-y-5">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:items-start">
            <div className="space-y-5 xl:col-span-8">
              <ShoutoutComposer
                variant="feed"
                employees={employees
                  .filter((e) => e.id !== currentMemberId)
                  .map((e) => ({ id: e.id, name: e.name }))}
                categories={categories}
                points={pointsBalance}
                recipientIds={recipientIds}
                onRecipientChange={setRecipientIds}
                categoryId={categoryId}
                onCategoryChange={setCategoryId}
                pointsValue={points}
                onPointsChange={setPoints}
                message={message}
                onMessageChange={setMessage}
                onSubmit={handleCreate}
                isSubmitting={createShoutout.isPending}
              />

              <ContentCard
                title="Activity feed"
                description="Recent recognition across your workspace"
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
                  items.map((shoutout) => <ShoutoutCard key={shoutout.id} shoutout={shoutout} />)
                )}
              </ContentCard>
            </div>

            <div className="space-y-5 xl:col-span-4">
              {pointsBalance && (
                <ContentCard
                  title="Allowance overview"
                  description="Track how much recognition budget you still have this cycle"
                  bodyClassName="space-y-4 p-5"
                >
                  <div className="dashboard-soft-tile space-y-3 rounded-[8px] px-4 py-4">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-slate-500 dark:text-slate-400">
                        Monthly give allowance
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {remainingAllowance} / {totalAllowance} pts left
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/70 dark:bg-slate-950/60">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#fea619] to-[#fcd34d] transition-all duration-500"
                        style={{ width: `${allowancePercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="dashboard-soft-tile rounded-[8px] px-4 py-3 text-center">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Redeemable balance
                      </p>
                      <p className="mt-1 flex items-center justify-center gap-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                        <Coins className="size-4 text-amber-500" />
                        {pointsBalance.currentBalance.toLocaleString()}
                      </p>
                    </div>
                    <div className="dashboard-soft-tile rounded-[8px] px-4 py-3 text-center">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Lifetime earned
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                        {pointsBalance.totalEarned.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => {
                      setTab('redeem');
                    }}
                  >
                    Go to Rewards Catalog
                  </Button>
                </ContentCard>
              )}

              <ContentCard
                title="Company core values"
                description="Recognition tags available across the workspace"
                bodyClassName="space-y-4 p-5"
              >
                {categories.length === 0 ? (
                  <div className="dashboard-soft-tile rounded-[8px] border border-dashed border-[#d7e3f6] px-4 py-5 text-center dark:border-slate-700">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      No core values set up yet
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {categories.map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1 rounded-full border border-indigo-500/10 bg-indigo-500/5 py-1 pl-2.5 pr-1.5 text-xs font-medium text-indigo-700 group dark:text-indigo-300"
                      >
                        <Sparkles className="size-3 text-indigo-500" />
                        {c.name}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(c.id)}
                            className="ml-1 rounded-full p-0.5 text-indigo-400 transition-colors hover:bg-indigo-500/10 hover:text-indigo-600"
                            disabled={deleteCategory.isPending}
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {isAdmin && (
                  <div className="flex gap-2 border-t border-[#d7e3f6] pt-4 dark:border-slate-700">
                    <Input
                      placeholder="Add core value..."
                      className="text-sm placeholder:text-muted-foreground/75"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCategory();
                      }}
                    />
                    <Button
                      size="sm"
                      className="px-3 text-xs font-semibold"
                      onClick={handleAddCategory}
                      disabled={createCategory.isPending}
                    >
                      Add
                    </Button>
                  </div>
                )}
              </ContentCard>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="redeem" className="mt-0 space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              Redeem Rewards
            </h2>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Redeem your points for digital vouchers, mobile top-ups, and custom perks
            </p>
          </div>
          <RewardsPage isTab={true} />
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
    <AppPage className="mx-auto w-full max-w-7xl">
      <Suspense fallback={<LoadingBlock />}>
        <ShoutoutsPageContent />
      </Suspense>
    </AppPage>
  );
}
