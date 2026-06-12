export type { Employee } from "@/lib/schemas/employee";

export interface EmployeeFilters {
  searchTerm: string;
  department: string;
  status: string;
}

export type ViewMode = "list" | "card";
