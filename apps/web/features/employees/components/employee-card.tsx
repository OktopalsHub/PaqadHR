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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {employees.length > 0 ? (
        employees.map((employee) => {
          const card = (
            <Card key={employee.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {employee.avatar ? (
                      <AvatarImage src={employee.avatar} alt={employee.name} />
                    ) : null}
                    <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">{employee.name}</CardTitle>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {employee.role ? (
                        <span
                          className="size-1.5 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: employee.positionColor || '#9ca3af' }}
                        />
                      ) : null}
                      <p className="text-sm text-muted-foreground">{employee.role || '—'}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-2 pt-0">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium truncate max-w-[180px]">{employee.email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Department:</span>
                    <div className="flex items-center gap-1.5">
                      {employee.department && (
                        <span
                          className="size-1.5 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: employee.departmentColor || '#9ca3af' }}
                        />
                      )}
                      <span className="font-medium">{employee.department || '—'}</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Join Date:</span>
                    <span className="font-medium">{employee.joinDate}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-2 border-t">
                <span
                  className={`px-2 py-1 rounded-full text-xs ${getStatusStyles(employee.status)}`}
                >
                  {employee.status}
                </span>
              </CardFooter>
            </Card>
          );

          return canLinkToDetail(employee) ? (
            <Link href={tenantHref(`employees/${employee.id}`)} key={employee.id}>
              {card}
            </Link>
          ) : (
            <div key={employee.id}>{card}</div>
          );
        })
      ) : (
        <div className="col-span-3 text-center py-8">No employees found</div>
      )}
    </div>
  );
};
