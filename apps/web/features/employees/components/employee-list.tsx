'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { PageActions } from '@/components/page-actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useDepartments } from '@/hooks/queries/use-departments';
import { useEmployees } from '@/hooks/queries/use-employees';
import { useEmployeeFilters } from '../hooks/';
import { AddEmployeeDialog } from './add-employee-dialog';
import { EmployeeCards } from './employee-card';
import { EmployeeFiltersComponent } from './employee-filters';
import { EmployeePagination } from './employee-pagination';
import { EmployeeTable } from './employee-table';
import { ViewModeToggle } from './view-mode-toggle';

export const EmployeeList = () => {
  const [inviteOpen, setInviteOpen] = useState(false);
  const { data: employees = [], isLoading, isError, error } = useEmployees();
  const { data: departments = [] } = useDepartments();

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
            {error instanceof Error ? error.message : 'Something went wrong'}
          </AlertDescription>
        </Alert>
      </AppPage>
    );
  }

  return (
    <AppPage>
      <PageActions>
        <Button className="flex items-center gap-2" onClick={() => setInviteOpen(true)}>
          <Plus size={16} />
          <span>Add employee</span>
        </Button>
      </PageActions>

      <AddEmployeeDialog isOpen={inviteOpen} onOpenChange={setInviteOpen} />

      <EmployeeFiltersComponent
        filters={filters}
        departments={departments}
        onFilterChange={updateFilter}
      />

      <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />

      {viewMode === 'list' ? (
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
