"use client";

import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLeaves } from "@/hooks/queries/use-leaves";
import { LeavePagination } from "./leave-pagination";
import { LeaveRequestDialog } from "./leave-request-dialog";
import { LeaveRequestsTable } from "./leave-requests-table";

const ITEMS_PER_PAGE = 5;

const LeaveManagement = () => {
  const [isRequestLeaveOpen, setIsRequestLeaveOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { data: leaveRequests = [], isLoading, isError, error } = useLeaves();

  const totalPages = Math.max(1, Math.ceil(leaveRequests.length / ITEMS_PER_PAGE));

  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return leaveRequests.slice(start, start + ITEMS_PER_PAGE);
  }, [leaveRequests, currentPage]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave Management</h1>
          <p className="text-muted-foreground">
            Manage and track employee leave requests.
          </p>
        </div>
        <LeaveRequestDialog
          open={isRequestLeaveOpen}
          onOpenChange={setIsRequestLeaveOpen}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load leave requests</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Something went wrong"}
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <LeaveRequestsTable requests={currentItems} />
          <LeavePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </div>
  );
};

export default LeaveManagement;
