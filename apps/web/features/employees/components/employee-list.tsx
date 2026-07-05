'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AppTablePanel } from '@/components/ui/app-table';
import { Button } from '@/components/ui/button';
import { Teams } from '@/features/teams/components/teams';
import { useDepartments } from '@/hooks/queries/use-departments';
import { useEmployees } from '@/hooks/queries/use-employees';
import { cn } from '@/lib/utils';
import { useTenant } from '@/providers/tenant-provider';
import { useEmployeeFilters } from '../hooks/';
import { AddEmployeeDialog } from './add-employee-dialog';
import { EmployeeCards } from './employee-card';
import { EmployeeFiltersComponent } from './employee-filters';
import { EmployeePagination } from './employee-pagination';
import { EmployeeTable } from './employee-table';
import { PositionsManager } from './positions-manager';

const EMPLOYEE_TABS = [
  { id: 'employees', label: 'Employees' },
  { id: 'departments', label: 'Departments' },
  { id: 'positions', label: 'Positions' },
] as const;

export const EmployeeList = () => {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'employees' | 'departments' | 'positions'>(
    'employees',
  );
  const [createDeptOpen, setCreateDeptOpen] = useState(false);
  const [createPositionOpen, setCreatePositionOpen] = useState(false);

  const { tenant } = useTenant();
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

  const actionConfig =
    activeTab === 'employees'
      ? {
          label: 'Add employee',
          onClick: () => setInviteOpen(true),
        }
      : activeTab === 'departments' && isAdmin
        ? {
            label: 'Add department',
            onClick: () => setCreateDeptOpen(true),
          }
        : activeTab === 'positions' && isAdmin
          ? {
              label: 'Add position',
              onClick: () => setCreatePositionOpen(true),
            }
          : null;

  return (
    <AppPage className="mx-auto w-full max-w-7xl space-y-6">
      <AddEmployeeDialog isOpen={inviteOpen} onOpenChange={setInviteOpen} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex min-w-max flex-nowrap items-center rounded-[8px] border border-slate-100 bg-white p-1 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]">
            {EMPLOYEE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'rounded-[8px] px-5 py-2 text-sm whitespace-nowrap transition-colors sm:px-6',
                  activeTab === tab.id
                    ? 'border border-slate-200 bg-slate-50 text-slate-800 shadow-sm font-semibold'
                    : 'font-medium text-slate-500 hover:text-slate-800',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {actionConfig ? (
          <Button
            variant="brandSolid"
            size="app"
            className="w-full sm:w-max"
            onClick={actionConfig.onClick}
          >
            <Plus className="size-4" />
            {actionConfig.label}
          </Button>
        ) : null}
      </div>

      {activeTab === 'employees' && (
        <div className="space-y-5">
          <EmployeeFiltersComponent
            filters={filters}
            departments={departments}
            onFilterChange={updateFilter}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />

          <AppTablePanel>
            {viewMode === 'list' ? (
              <EmployeeTable
                employees={currentEmployees}
                viewerMemberId={viewerMemberId}
                viewerRole={role}
              />
            ) : (
              <div className="p-4">
                <EmployeeCards
                  employees={currentEmployees}
                  viewerMemberId={viewerMemberId}
                  viewerRole={role}
                />
              </div>
            )}

            <EmployeePagination
              currentPage={currentPage}
              pageNumbers={pageNumbers}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={updateItemsPerPage}
            />
          </AppTablePanel>
        </div>
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
