'use client';

import Link from 'next/link';
import { memo } from 'react';
import { PersonAvatar } from '@/components/person-avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { canManageMember } from '@/lib/auth/manager-access';
import type { Employee } from '../types/';
import { getStatusStyles } from '../utils/';

interface EmployeeCardsProps {
  employees: Employee[];
  viewerMemberId?: string;
  viewerRole?: string | null;
}

export const EmployeeCards = memo(
  ({ employees, viewerMemberId, viewerRole }: EmployeeCardsProps) => {
    const tenantHref = useTenantHref();

    const canLinkToDetail = (employee: Employee) =>
      Boolean(viewerMemberId && canManageMember(viewerMemberId, employee, viewerRole));

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1680px]:grid-cols-6">
        {employees.length > 0 ? (
          employees.map((employee) => {
            const card = (
              <Card
                key={employee.id}
                className="overflow-hidden gap-0 rounded-[8px] border-slate-200 py-0 transition-[border-color,box-shadow,background-color] hover:border-primary/20 hover:bg-white/85 hover:shadow-sm dark:hover:bg-slate-950/80"
              >
                <CardHeader className="px-3 py-3 pb-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <PersonAvatar
                        src={employee.avatar}
                        name={employee.name}
                        className="size-10 border border-slate-200 bg-slate-100 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                        fallbackClassName="bg-slate-100 text-xs font-bold text-slate-800 dark:bg-slate-900 dark:text-slate-200"
                      />
                      <div className="min-w-0">
                        <CardTitle className="truncate text-[15px] font-semibold text-slate-900 dark:text-foreground">
                          {employee.name}
                        </CardTitle>
                        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                          {employee.role ? (
                            <span
                              className="size-1.5 shrink-0 rounded-full border border-black/10"
                              style={{ backgroundColor: employee.positionColor || '#9ca3af' }}
                            />
                          ) : null}
                          <p className="truncate text-xs text-slate-500 dark:text-muted-foreground">
                            {employee.role || 'No role assigned'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${getStatusStyles(
                        employee.status,
                      )}`}
                    >
                      {employee.status}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="px-3 pb-3 pt-0">
                  <div className="rounded-[8px] border border-border/60 bg-muted/20 p-2.5 dark:bg-slate-950/30">
                    <dl className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-2">
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                        Email
                      </dt>
                      <dd className="min-w-0 truncate text-[13px] font-medium text-slate-800 dark:text-slate-200">
                        {employee.email}
                      </dd>

                      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                        Dept
                      </dt>
                      <dd className="min-w-0">
                        <div className="flex items-center justify-end gap-2">
                          {employee.department ? (
                            <span
                              className="size-1.5 shrink-0 rounded-full border border-black/10"
                              style={{ backgroundColor: employee.departmentColor || '#9ca3af' }}
                            />
                          ) : null}
                          <span className="truncate text-[13px] font-medium text-slate-800 dark:text-slate-200">
                            {employee.department || '—'}
                          </span>
                        </div>
                      </dd>

                      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                        Joined
                      </dt>
                      <dd className="text-[13px] font-medium text-slate-800 dark:text-slate-200">
                        {employee.joinDate || '—'}
                      </dd>
                    </dl>
                  </div>
                </CardContent>
              </Card>
            );

            return canLinkToDetail(employee) ? (
              <Link
                href={tenantHref(`employees/${employee.id}`)}
                key={employee.id}
                className="block"
              >
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
  },
);
