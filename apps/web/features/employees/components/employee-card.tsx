'use client';

import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { canManageMember } from '@/lib/auth/manager-access';
import { getInitials } from '@/lib/utils';
import type { Employee } from '../types/';
import { getStatusStyles } from '../utils/';

interface EmployeeCardsProps {
  employees: Employee[];
  viewerMemberId?: string;
  viewerRole?: string | null;
}

export const EmployeeCards = ({ employees, viewerMemberId, viewerRole }: EmployeeCardsProps) => {
  const tenantHref = useTenantHref();

  const canLinkToDetail = (employee: Employee) =>
    Boolean(viewerMemberId && canManageMember(viewerMemberId, employee, viewerRole));

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {employees.length > 0 ? (
        employees.map((employee) => {
          const card = (
            <Card
              key={employee.id}
              className="overflow-hidden rounded-[8px] border-slate-200 transition-colors hover:bg-slate-50/40 hover:shadow-sm"
            >
              <CardHeader className="pb-1">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 border border-slate-200 bg-slate-100">
                    <AvatarImage src={employee.avatar || '/placeholder.svg'} alt={employee.name} />
                    <AvatarFallback className="bg-slate-100 text-[10px] font-bold text-slate-800">
                      {getInitials(employee.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-sm text-slate-800 dark:text-foreground">
                      {employee.name}
                    </CardTitle>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {employee.role ? (
                        <span
                          className="size-1.5 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: employee.positionColor || '#9ca3af' }}
                        />
                      ) : null}
                      <p className="text-xs text-slate-500 dark:text-muted-foreground">
                        {employee.role || '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-3 pt-2">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-500 dark:text-muted-foreground">
                      Email:
                    </span>
                    <span className="max-w-[180px] truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                      {employee.email}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 dark:text-muted-foreground">
                      Department:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {employee.department && (
                        <span
                          className="size-1.5 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: employee.departmentColor || '#9ca3af' }}
                        />
                      )}
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                        {employee.department || '—'}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-500 dark:text-muted-foreground">
                      Join Date:
                    </span>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                      {employee.joinDate || '—'}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t border-slate-200 pt-3 dark:border-slate-700/80">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusStyles(employee.status)}`}
                >
                  {employee.status}
                </span>
              </CardFooter>
            </Card>
          );

          return canLinkToDetail(employee) ? (
            <Link href={tenantHref(`employees/${employee.id}`)} key={employee.id} className="block">
              {card}
            </Link>
          ) : (
            <div key={employee.id}>{card}</div>
          );
        })
      ) : (
        <div className="col-span-full rounded-[8px] border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center text-sm text-slate-500 dark:border-slate-700/80 dark:bg-slate-900/40 dark:text-muted-foreground">
          No employees found
        </div>
      )}
    </div>
  );
};
