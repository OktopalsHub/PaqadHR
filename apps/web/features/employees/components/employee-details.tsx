"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmployee } from "@/hooks/queries/use-employees";
import type { Employee } from "@/lib/schemas/employee";
import { useBreadcrumbTail } from "@/providers/breadcrumb-provider";
import { useParams } from "next/navigation";
import { EmployeeDetailHeader } from "./detail/employee-detail-header";
import { EmployeeDetailSidebar } from "./detail/employee-detail-sidebar";
import { EmployeeDetailTabs } from "./detail/tabs/employee-detail-tabs";
import { useEmployeeDetailForm } from "../hooks/use-employee-detail-form";

function EmployeeDetailView({ baseEmployee }: { baseEmployee: Employee }) {
  const form = useEmployeeDetailForm(baseEmployee);

  return (
    <div className="space-y-6">
      <EmployeeDetailHeader
        isDirty={form.isDirty}
        onSave={form.handleSaveChanges}
      />

      <div className="flex flex-col md:flex-row gap-6">
        <EmployeeDetailSidebar
          employee={form.employee}
          onInputChange={form.handleInputChange}
        />
        <EmployeeDetailTabs form={form} />
      </div>
    </div>
  );
}

const EmployeeDetail = () => {
  const { employeeID: id } = useParams<{ employeeID: string }>();
  const { data: employee, isLoading, isError, error } = useEmployee(id);

  useBreadcrumbTail(employee?.name ?? null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError || !employee) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load employee</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : "Employee not found"}
        </AlertDescription>
      </Alert>
    );
  }

  return <EmployeeDetailView key={employee.id} baseEmployee={employee} />;
};

export default EmployeeDetail;
