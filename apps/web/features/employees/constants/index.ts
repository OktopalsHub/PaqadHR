export const DEPARTMENTS = [
  { value: "all_departments", label: "All Departments" },
  { value: "Engineering", label: "Engineering" },
  { value: "Design", label: "Design" },
  { value: "Marketing", label: "Marketing" },
  { value: "HR", label: "HR" },
  { value: "Finance", label: "Finance" },
  { value: "Sales", label: "Sales" },
] as const;

export const STATUSES = [
  { value: "all_statuses", label: "All Status" },
  { value: "Active", label: "Active" },
  { value: "On Leave", label: "On Leave" },
  { value: "Inactive", label: "Inactive" },
] as const;

export const ITEMS_PER_PAGE_OPTIONS = [
  { value: "6", label: "6" },
  { value: "12", label: "12" },
  { value: "24", label: "24" },
  { value: "48", label: "48" },
] as const;
