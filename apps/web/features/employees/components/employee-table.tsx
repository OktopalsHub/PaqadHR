'use client';

import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { canManageMember } from '@/lib/auth/manager-access';
import { getInitials } from '@/lib/utils';
import { useTenant } from '@/providers/tenant-provider';
import type { Employee } from '../types/';
import { getStatusStyles } from '../utils/';

interface EmployeeTableProps {
  employees: Employee[];
  viewerMemberId?: string;
  viewerRole?: string | null;
}

export const EmployeeTable = ({ employees, viewerMemberId, viewerRole }: EmployeeTableProps) => {
  const tenantHref = useTenantHref();
  const { tenant } = useTenant();

  const canLinkToDetail = (employee: Employee) =>
    Boolean(viewerMemberId && canManageMember(viewerMemberId, employee, viewerRole));

  const getEmployeeId = (employee: Employee) => {
    if (!employee.employeeNumber) return '—';
    const prefix = tenant?.employeeCode ? `${tenant.employeeCode}-` : '';
    return `${prefix}${employee.employeeNumber}`;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Join Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.length > 0 ? (
            employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell className="font-mono text-xs">{getEmployeeId(employee)}</TableCell>
                <TableCell className="font-medium">
                  {canLinkToDetail(employee) ? (
                    <Link
                      href={tenantHref(`employees/${employee.id}`)}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Avatar className="h-8 w-8">
                        {employee.avatar ? <AvatarImage src={employee.avatar} /> : null}
                        <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
                      </Avatar>
                      {employee.name}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        {employee.avatar ? <AvatarImage src={employee.avatar} /> : null}
                        <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
                      </Avatar>
                      {employee.name}
                    </div>
                  )}
                </TableCell>
                <TableCell>{employee.email}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {employee.department ? (
                      <span
                        className="size-2 rounded-full shrink-0 border border-black/10"
                        style={{
                          backgroundColor: employee.departmentColor || '#9ca3af',
                        }}
                      />
                    ) : null}
                    <span>{employee.department || '—'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {employee.role ? (
                      <span
                        className="size-2 rounded-full shrink-0 border border-black/10"
                        style={{ backgroundColor: employee.positionColor || '#9ca3af' }}
                      />
                    ) : null}
                    <span>{employee.role || '—'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusStyles(employee.status)}`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        employee.status === 'Active'
                          ? 'bg-green-500 animate-pulse'
                          : employee.status === 'On Leave'
                            ? 'bg-amber-500'
                            : 'bg-gray-450 dark:bg-gray-500'
                      }`}
                    />
                    {employee.status}
                  </span>
                </TableCell>
                <TableCell>{employee.joinDate || '—'}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8">
                No employees found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
