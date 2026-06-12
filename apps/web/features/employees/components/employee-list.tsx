"use client";

import { useState } from "react";
import { useEmployeeFilters } from "../hooks/";
import { EmployeeFiltersComponent } from "./employee-filters";
import { ViewModeToggle } from "./view-mode-toggle";
import { EmployeeTable } from "./employee-table";
import { EmployeeCards } from "./employee-card";
import { AddEmployeeDialog } from "./add-employee-dialog";
import { EmployeePagination } from "./employee-pagination";
import { useEmployees } from "@/hooks/queries/use-employees";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const EmployeeList = () => {
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const { data: employees = [], isLoading, isError, error } = useEmployees();

  const {
    filters,
    viewMode,
    currentPage,
    itemsPerPage,
    currentEmployees,
    pageNumbers,
    updateFilter,
    setViewMode,
    setCurrentPage,
    updateItemsPerPage,
  } = useEmployeeFilters({ employees });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load employees</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : "Something went wrong"}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground">
            Manage your employee directory.
          </p>
        </div>
        <AddEmployeeDialog
          isOpen={isAddEmployeeOpen}
          onOpenChange={setIsAddEmployeeOpen}
        />
      </div>

      <EmployeeFiltersComponent
        filters={filters}
        onFilterChange={updateFilter}
      />

      <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />

      {viewMode === "list" ? (
        <EmployeeTable employees={currentEmployees} />
      ) : (
        <EmployeeCards employees={currentEmployees} />
      )}

      <EmployeePagination
        currentPage={currentPage}
        pageNumbers={pageNumbers}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={updateItemsPerPage}
      />
    </div>
  );
};
