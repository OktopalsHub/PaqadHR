'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { PageActions } from '@/components/page-actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Teams } from '@/features/teams/components/teams';
import { useDepartments } from '@/hooks/queries/use-departments';
import { useEmployees } from '@/hooks/queries/use-employees';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { cn } from '@/lib/utils';
import { useTenant } from '@/providers/tenant-provider';
import { useEmployeeFilters } from '../hooks/';
import { AddEmployeeDialog } from './add-employee-dialog';
import { EmployeeCards } from './employee-card';
import { EmployeeFiltersComponent } from './employee-filters';
import { EmployeePagination } from './employee-pagination';
import { EmployeeTable } from './employee-table';
import { PositionsManager } from './positions-manager';
import { ViewModeToggle } from './view-mode-toggle';

export const EmployeeList = () => {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'employees' | 'departments' | 'positions'>(
    'employees',
  );
  const [createDeptOpen, setCreateDeptOpen] = useState(false);
  const [createPositionOpen, setCreatePositionOpen] = useState(false);

  const { tenant } = useTenant();
  const _tenantHref = useTenantHref();
  const role = tenant?.member?.role;
  const viewerMemberId = tenant?.member?.id;
  const adminRole = role?.toLowerCase();
  const isAdmin = adminRole === 'owner' || adminRole === 'admin';
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
        {activeTab === 'employees' && (
          <Button className="flex items-center gap-2" onClick={() => setInviteOpen(true)}>
            <Plus size={16} />
            <span>Add employee</span>
          </Button>
        )}
        {activeTab === 'departments' && isAdmin && (
          <Button className="flex items-center gap-2" onClick={() => setCreateDeptOpen(true)}>
            <Plus size={16} />
            <span>Add department</span>
          </Button>
        )}
        {activeTab === 'positions' && isAdmin && (
          <Button className="flex items-center gap-2" onClick={() => setCreatePositionOpen(true)}>
            <Plus size={16} />
            <span>Add position</span>
          </Button>
        )}
      </PageActions>

      <AddEmployeeDialog isOpen={inviteOpen} onOpenChange={setInviteOpen} />

      <div className="flex border-b border-border mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('employees')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px',
            activeTab === 'employees'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30',
          )}
        >
          Employees
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('departments')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px',
            activeTab === 'departments'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30',
          )}
        >
          Departments
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('positions')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px',
            activeTab === 'positions'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30',
          )}
        >
          Positions
        </button>
      </div>

      {activeTab === 'employees' && (
        <>
          <EmployeeFiltersComponent
            filters={filters}
            departments={departments}
            onFilterChange={updateFilter}
          />

          <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />

          {viewMode === 'list' ? (
            <EmployeeTable
              employees={currentEmployees}
              viewerMemberId={viewerMemberId}
              viewerRole={role}
            />
          ) : (
            <EmployeeCards
              employees={currentEmployees}
              viewerMemberId={viewerMemberId}
              viewerRole={role}
            />
          )}

          <EmployeePagination
            currentPage={currentPage}
            pageNumbers={pageNumbers}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={updateItemsPerPage}
          />
        </>
      )}

      {activeTab === 'departments' && (
        <Teams
          hidePageActions={true}
          createOpenExternal={createDeptOpen}
          setCreateOpenExternal={setCreateDeptOpen}
        />
      )}

      {activeTab === 'positions' && (
        <PositionsManager
          hidePageActions={true}
          createOpenExternal={createPositionOpen}
          setCreateOpenExternal={setCreatePositionOpen}
        />
      )}
    </AppPage>
  );
};
