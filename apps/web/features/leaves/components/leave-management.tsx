'use client';

import { CalendarClock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppPage } from '@/components/app-page';
import { ContentCard } from '@/components/content-card';
import { EmptyState } from '@/components/empty-state';
import { PageActions } from '@/components/page-actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeaveBalances, useLeaves } from '@/hooks/queries/use-leaves';
import { clampLeavePage } from '../lib/leave-pagination-state';
import { LeaveBalancesPanel } from './leave-balances-panel';
import { LeavePagination } from './leave-pagination';
import { LeaveRequestDialog } from './leave-request-dialog';
import { LeaveRequestsTable } from './leave-requests-table';

const ITEMS_PER_PAGE = 5;

function countByStatus(requests: { status: string }[], statuses: string[]) {
  return requests.filter((r) => statuses.includes(r.status.toLowerCase())).length;
}

function LeaveRequestsLoading() {
  return (
    <div className="space-y-3 p-4" role="status" aria-label="Loading leave requests">
      {[1, 2, 3, 4, 5].map((row) => (
        <Skeleton key={row} className="h-12 w-full" />
      ))}
    </div>
  );
}

function LeaveBalancesLoading() {
  return (
    <ContentCard title="Your balances">
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </ContentCard>
  );
}

const LeaveManagement = () => {
  const [isRequestLeaveOpen, setIsRequestLeaveOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { data: leaveRequests = [], isLoading, isError, error } = useLeaves();
  const { data: balances = [] } = useLeaveBalances();

  const totalPages = Math.max(1, Math.ceil(leaveRequests.length / ITEMS_PER_PAGE));
  const visiblePage = clampLeavePage(currentPage, totalPages);

  useEffect(() => {
    if (visiblePage !== currentPage) {
      setCurrentPage(visiblePage);
    }
  }, [currentPage, visiblePage]);

  const currentItems = useMemo(() => {
    const start = (visiblePage - 1) * ITEMS_PER_PAGE;
    return leaveRequests.slice(start, start + ITEMS_PER_PAGE);
  }, [leaveRequests, visiblePage]);

  const pendingCount = countByStatus(leaveRequests, ['pending']);
  const approvedCount = countByStatus(leaveRequests, ['approved']);
  const closedCount = countByStatus(leaveRequests, ['rejected', 'cancelled']);

  return (
    <AppPage className="space-y-6">
      <PageActions>
        <LeaveRequestDialog open={isRequestLeaveOpen} onOpenChange={setIsRequestLeaveOpen} />
      </PageActions>

      <p className="text-sm text-muted-foreground">
        {isLoading
          ? 'Loading requests…'
          : `${pendingCount} pending · ${approvedCount} approved · ${closedCount} closed · ${leaveRequests.length} total`}
      </p>

      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load leave requests</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Something went wrong'}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            <ContentCard
              title="Leave requests"
              className="dashboard-panel rounded-[8px]"
              bodyClassName="min-h-[220px] p-0"
            >
              {isLoading ? (
                <LeaveRequestsLoading />
              ) : leaveRequests.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={CalendarClock}
                    title="No leave requests"
                    description="Submit a request."
                    className="min-h-[200px] bg-white dark:bg-slate-950/60"
                  />
                </div>
              ) : (
                <>
                  <LeaveRequestsTable
                    requests={currentItems}
                    rowNumberOffset={(visiblePage - 1) * ITEMS_PER_PAGE}
                  />
                  <LeavePagination
                    currentPage={visiblePage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                </>
              )}
            </ContentCard>
          </div>

          {isLoading ? (
            <aside className="lg:sticky lg:top-16 lg:self-start">
              <LeaveBalancesLoading />
            </aside>
          ) : balances.length > 0 ? (
            <aside className="lg:self-stretch">
              <LeaveBalancesPanel balances={balances} className="h-full" />
            </aside>
          ) : null}
        </div>
      )}
    </AppPage>
  );
};

export default LeaveManagement;
