"use client";

import { useState } from "react";
import { AppPage } from "@/components/app-page";
import { LoadingBlock } from "@/components/loading-block";
import { PageActions } from "@/components/page-actions";
import { useEmployeeFilters } from "../hooks/";
import { EmployeeFiltersComponent } from "./employee-filters";
import { ViewModeToggle } from "./view-mode-toggle";
import { EmployeeTable } from "./employee-table";
import { EmployeeCards } from "./employee-card";
import { AddEmployeeDialog } from "./add-employee-dialog";
import { EmployeePagination } from "./employee-pagination";
import { useEmployees } from "@/hooks/queries/use-employees";
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
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  if (isError) {
    return (
      <AppPage>
        <Alert variant="destructive">
          <AlertTitle>Unable to load employees</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Something went wrong"}
          </AlertDescription>
        </Alert>
      </AppPage>
    );
  }

  return (
    <AppPage>
      <PageActions>
        <AddEmployeeDialog
          isOpen={isAddEmployeeOpen}
          onOpenChange={setIsAddEmployeeOpen}
        />
      </PageActions>

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
    </AppPage>
  );
};
