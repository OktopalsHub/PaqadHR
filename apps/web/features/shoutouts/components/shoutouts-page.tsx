'use client';

import { Award, Coins, Heart, Sparkles, Trophy, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AppPage } from '@/components/app-page';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RewardsPage } from '@/features/rewards/components/rewards-page';
import { settingsTabHref } from '@/features/settings/lib/settings-tabs';
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
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
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
  const tenantHref = useTenantHref();
  const currentMemberId = tenant?.member?.id;
  const settingsBase = tenantHref('settings');
  const _shoutoutsSettingsLink = settingsTabHref(settingsBase, 'shoutouts');

  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';

  const { data: employees = [] } = useEmployees();
  const { data: categories = [] } = useShoutoutCategories();
  const { data: pointsBalance } = useMyPointsBalance();
  const { data, isLoading, isError, error } = useShoutouts();
  const createShoutout = useCreateShoutout();

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
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Shoutouts & Recognition</h1>
        <p className="text-sm text-muted-foreground font-medium">
          Appreciate your colleagues, earn points checklist rewards, and redeem vouchers
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList className="h-auto w-full justify-start flex-wrap gap-1.5 p-1.5 bg-muted/60">
          <TabsTrigger
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 h-auto text-xs font-semibold"
            value="feed"
          >
            Shoutouts Feed
          </TabsTrigger>
          <TabsTrigger
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 h-auto text-xs font-semibold"
            value="tasks"
          >
            Points Tasks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="mt-5 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {}
            <div className="lg:col-span-8 space-y-6">
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

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Activity Feed
                  </h2>
                  <span className="text-xs text-muted-foreground font-medium">
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

            {}
            <div className="lg:col-span-4 space-y-6">
              {}
              {pointsBalance && (
                <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                    <Trophy className="size-4 text-amber-500" />
                    Your Point Allowance
                  </h3>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">
                        Monthly Give Allowance
                      </span>
                      <span className="font-bold text-foreground">
                        {remainingAllowance} / {totalAllowance} pts left
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${allowancePercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50 text-center">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">
                        Redeemable Balance
                      </p>
                      <p className="text-lg font-bold text-primary flex items-center justify-center gap-1">
                        <Coins className="size-4 text-amber-500" />
                        {pointsBalance.currentBalance.toLocaleString()}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">Lifetime Earned</p>
                      <p className="text-lg font-bold text-foreground">
                        {pointsBalance.totalEarned.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => {
                      document
                        .getElementById('rewards-section')
                        ?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    Go to Rewards Catalog
                  </Button>
                </div>
              )}

              {}
              <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                  <Award className="size-4 text-indigo-500" />
                  Company Core Values
                </h3>

                {categories.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      No core values set up yet
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {categories.map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-indigo-500/5 text-indigo-700 dark:text-indigo-400 border border-indigo-500/10 group"
                      >
                        <Sparkles className="size-3 text-indigo-500" />
                        {c.name}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(c.id)}
                            className="ml-1 text-indigo-400 hover:text-indigo-600 rounded-full hover:bg-indigo-500/10 p-0.5 transition-colors"
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
                  <div className="flex gap-1.5 pt-2 border-t border-border/40">
                    <Input
                      placeholder="Add core value..."
                      className="h-8 text-xs placeholder:text-muted-foreground/75"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCategory();
                      }}
                    />
                    <Button
                      size="sm"
                      className="h-8 px-2.5 text-xs font-semibold"
                      onClick={handleAddCategory}
                      disabled={createCategory.isPending}
                    >
                      Add
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {}
          <div id="rewards-section" className="border-t border-border/60 pt-8 space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight">Redeem Rewards</h2>
              <p className="text-sm text-muted-foreground font-medium">
                Redeem your points for digital vouchers, mobile top-ups, and custom perks
              </p>
            </div>
            <RewardsPage isTab={true} />
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-5">
          <ShoutoutTasksTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ShoutoutsPage() {
  return (
    <AppPage className="max-w-7xl mx-auto w-full py-4">
      <Suspense fallback={<LoadingBlock />}>
        <ShoutoutsPageContent />
      </Suspense>
    </AppPage>
  );
}
