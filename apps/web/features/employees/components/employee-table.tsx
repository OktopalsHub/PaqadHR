'use client';

import Link from 'next/link';
import { memo } from 'react';
import { PersonAvatar } from '@/components/person-avatar';
import {
  AppTable,
  AppTableBodyRow,
  AppTableBodySection,
  AppTableCell,
  AppTableHeadCell,
  AppTableHeaderRow,
  AppTableHeaderSection,
} from '@/components/ui/app-table';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { canManageMember } from '@/lib/auth/manager-access';
import { useTenant } from '@/providers/tenant-provider';
import type { Employee } from '../types/';
import { getStatusStyles } from '../utils/';

interface EmployeeTableProps {
  employees: Employee[];
  viewerMemberId?: string;
  viewerRole?: string | null;
}

export const EmployeeTable = memo(
  ({ employees, viewerMemberId, viewerRole }: EmployeeTableProps) => {
    const tenantHref = useTenantHref();
    const { tenant } = useTenant();

    const canLinkToDetail = (employee: Employee) =>
      Boolean(viewerMemberId && canManageMember(viewerMemberId, employee, viewerRole));

    const getEmployeeId = (employee: Employee) => {
      if (!employee.employeeNumber) return '—';
      const prefix = tenant?.employeeCode ? `${tenant.employeeCode}-` : '';
      return `${prefix}${employee.employeeNumber}`;
    };

    const getStatusDotClass = (status: Employee['status']) => {
      switch (status) {
        case 'Active':
          return 'bg-green-500';
        case 'On Leave':
          return 'bg-amber-500';
        default:
          return 'bg-slate-400';
      }
    };

    return (
      <AppTable className="min-w-[980px]">
        <AppTableHeaderSection>
          <AppTableHeaderRow>
            <AppTableHeadCell>ID</AppTableHeadCell>
            <AppTableHeadCell>Name</AppTableHeadCell>
            <AppTableHeadCell>Email</AppTableHeadCell>
            <AppTableHeadCell>Department</AppTableHeadCell>
            <AppTableHeadCell>Position</AppTableHeadCell>
            <AppTableHeadCell>Status</AppTableHeadCell>
            <AppTableHeadCell>Join Date</AppTableHeadCell>
          </AppTableHeaderRow>
        </AppTableHeaderSection>
        <AppTableBodySection>
          {employees.length > 0 ? (
            employees.map((employee) => (
              <AppTableBodyRow key={employee.id}>
                <AppTableCell className="whitespace-normal font-medium">
                  {getEmployeeId(employee)}
                </AppTableCell>
                <AppTableCell>
                  {canLinkToDetail(employee) ? (
                    <Link
                      href={tenantHref(`employees/${employee.id}`)}
                      className="flex items-center gap-3 hover:underline"
                    >
                      <PersonAvatar
                        src={employee.avatar}
                        name={employee.name}
                        className="size-8 border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900"
                        fallbackClassName="bg-slate-100 text-[10px] font-bold text-slate-800 dark:bg-slate-900 dark:text-slate-200"
                      />
                      <span className="text-sm font-semibold text-slate-800">{employee.name}</span>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3">
                      <PersonAvatar
                        src={employee.avatar}
                        name={employee.name}
                        className="size-8 border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900"
                        fallbackClassName="bg-slate-100 text-[10px] font-bold text-slate-800 dark:bg-slate-900 dark:text-slate-200"
                      />
                      <span className="text-sm font-semibold text-slate-800">{employee.name}</span>
                    </div>
                  )}
                </AppTableCell>
                <AppTableCell>{employee.email}</AppTableCell>
                <AppTableCell>
                  <div className="flex items-center gap-2">
                    {employee.department ? (
                      <span
                        className="size-2 shrink-0 rounded-full border border-black/10"
                        style={{ backgroundColor: employee.departmentColor || '#c0cadc' }}
                      />
                    ) : null}
                    <span>{employee.department || '—'}</span>
                  </div>
                </AppTableCell>
                <AppTableCell>
                  <div className="flex items-center gap-2">
                    {employee.role ? (
                      <span
                        className="size-2 shrink-0 rounded-full border border-black/10"
                        style={{ backgroundColor: employee.positionColor || '#c0cadc' }}
                      />
                    ) : null}
                    <span>{employee.role || '—'}</span>
                  </div>
                </AppTableCell>
                <AppTableCell>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusStyles(employee.status)}`}
                  >
                    <span className={`size-2 rounded-full ${getStatusDotClass(employee.status)}`} />
                    {employee.status}
                  </span>
                </AppTableCell>
                <AppTableCell>{employee.joinDate || '—'}</AppTableCell>
              </AppTableBodyRow>
            ))
          ) : (
            <AppTableBodyRow className="hover:bg-transparent">
              <AppTableCell colSpan={7} className="py-12 text-center text-sm text-slate-500">
                No employees found
              </AppTableCell>
            </AppTableBodyRow>
          )}
        </AppTableBodySection>
      </AppTable>
    );
  },
);
