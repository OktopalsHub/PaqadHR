import { AppPage } from '@/components/app-page';
import { Skeleton } from '@/components/ui/skeleton';

export function PageLoadingSkeleton() {
  return (
    <AppPage className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </AppPage>
  );
}
