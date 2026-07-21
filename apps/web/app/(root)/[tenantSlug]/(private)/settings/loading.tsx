import { AppPage } from '@/components/app-page';
import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsLoading() {
  return (
    <AppPage className="mx-auto w-full max-w-7xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="space-y-5">
        <Skeleton className="h-11 w-full max-w-3xl rounded-lg" />
        <div className="space-y-4 rounded-xl border border-border p-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-10 w-full max-w-sm" />
          <Skeleton className="h-10 w-full max-w-sm" />
        </div>
      </div>
    </AppPage>
  );
}
