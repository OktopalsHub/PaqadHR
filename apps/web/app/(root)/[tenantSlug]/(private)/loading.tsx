import { AppPage } from '@/components/app-page';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shown the moment a workspace link is clicked, so the shell stays interactive
 * and the new route paints a placeholder instead of the old page freezing
 * while the server responds. Next prefetches this fallback for every link.
 */
export default function PrivateRouteLoading() {
  return (
    <AppPage className="space-y-6" aria-busy="true" aria-label="Loading page">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </AppPage>
  );
}
