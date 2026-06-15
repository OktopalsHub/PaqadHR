"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Employee } from "../types/";
import { getInitials } from "@/lib/utils";
import { useTenantHref } from "@/hooks/use-tenant-nav-items";
import { getStatusStyles } from "../utils/";

interface EmployeeCardsProps {
  employees: Employee[];
}

export const EmployeeCards = ({ employees }: EmployeeCardsProps) => {
  const tenantHref = useTenantHref();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {employees.length > 0 ? (
        employees.map((employee) => (
          <Link href={tenantHref(`employees/${employee.id}`)} key={employee.id}>
            <Card className="overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={employee.avatar || "/placeholder.svg"}
                      alt={employee.name}
                    />
                    <AvatarFallback>
                      {getInitials(employee.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">{employee.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {employee.role}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-2 pt-0">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium truncate max-w-[180px]">
                      {employee.email}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Department:</span>
                    <span className="font-medium">{employee.department}</span>
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
          </Link>
        ))
      ) : (
        <div className="col-span-3 text-center py-8">No employees found</div>
      )}
    </div>
  );
};
