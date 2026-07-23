'use client';

import { Building2, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppPage } from '@/components/app-page';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
import { PageActions } from '@/components/page-actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDepartments } from '@/hooks/queries/use-departments';
import { isTenantAdmin } from '@/lib/auth/manager-access';
import { useTenant } from '@/providers/tenant-provider';
import { CreateDepartmentDialog } from './create-department-dialog';
import { DepartmentCard } from './department-card';

export const Teams = ({
  hidePageActions = false,
  createOpenExternal,
  setCreateOpenExternal,
}: {
  hidePageActions?: boolean;
  createOpenExternal?: boolean;
  setCreateOpenExternal?: (open: boolean) => void;
}) => {
  const { tenant } = useTenant();
  const isAdmin = isTenantAdmin(tenant?.member?.role);
  const [searchTerm, setSearchTerm] = useState('');
  const [createOpenInternal, setCreateOpenInternal] = useState(false);
  const createOpen = createOpenExternal !== undefined ? createOpenExternal : createOpenInternal;
  const setCreateOpen =
    setCreateOpenExternal !== undefined ? setCreateOpenExternal : setCreateOpenInternal;
  const [expandedDepts, setExpandedDepts] = useState<string[]>([]);
  const { data: departments = [], isLoading, isError, error } = useDepartments();

  const filteredDepartments = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return departments.filter(
      (dept) =>
        dept.name.toLowerCase().includes(term) ||
        (dept.description?.toLowerCase().includes(term) ?? false) ||
        dept.members.some(
          (member) =>
            member.name.toLowerCase().includes(term) ||
            (member.role?.toLowerCase().includes(term) ?? false),
        ),
    );
  }, [departments, searchTerm]);

  const toggleDepartment = (deptId: string) => {
    setExpandedDepts((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId],
    );
  };

  if (isLoading) {
    return (
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  return (
    <AppPage>
      {!hidePageActions && isAdmin ? (
        <PageActions>
          <Button
            variant="brandSolid"
            size="app"
            className="gap-2"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={16} />
            Add department
          </Button>
        </PageActions>
      ) : null}

      {isAdmin ? <CreateDepartmentDialog open={createOpen} onOpenChange={setCreateOpen} /> : null}

      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load departments</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Something went wrong'}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4">
          <div className="rounded-[8px] border border-slate-100 bg-white p-4 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search departments or members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 rounded-[8px] border border-slate-200/45 bg-white py-2 pl-10 pr-3 text-sm text-slate-700 shadow-none placeholder:text-slate-400 focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24]"
              />
            </div>
          </div>

          {departments.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No departments yet"
              description="Create your first department to organize teams and members."
              className="min-h-[340px] bg-white sm:min-h-[440px]"
            />
          ) : filteredDepartments.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No matches"
              description="Try a different search term."
              className="min-h-[340px] bg-white sm:min-h-[440px]"
            />
          ) : (
            <div className="grid gap-4">
              {filteredDepartments.map((dept) => (
                <DepartmentCard
                  key={dept.id}
                  department={dept}
                  isExpanded={expandedDepts.includes(dept.id)}
                  onToggle={() => toggleDepartment(dept.id)}
                  canManage={isAdmin}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </AppPage>
  );
};
