import { apiClient, tenantPath } from "@/lib/api/client";
import { resolveTenantId } from "@/lib/api/tenants";
import { mapTenantMembersToEmployees } from "@/lib/mappers/employee";
import {
  employeeListSchema,
  employeeSchema,
  type Employee,
} from "@/lib/schemas/employee";

export async function fetchEmployees(): Promise<Employee[]> {
  const tenantId = await resolveTenantId();
  const members = await apiClient<unknown[]>(tenantPath(tenantId, "members"));
  return employeeListSchema.parse(mapTenantMembersToEmployees(members as never));
}

export async function fetchEmployeeById(id: string): Promise<Employee> {
  const employees = await fetchEmployees();
  const employee = employees.find((item) => item.id === id);
  if (!employee) throw new Error("Employee not found");
  return employeeSchema.parse(employee);
}
