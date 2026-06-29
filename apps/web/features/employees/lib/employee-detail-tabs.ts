export const EMPLOYEE_DETAIL_TABS = [
  'personal',
  'emergency',
  'employment',
  'education',
  'documents',
] as const;

export type EmployeeDetailTab = (typeof EMPLOYEE_DETAIL_TABS)[number];

export function isEmployeeDetailTab(value: string | null): value is EmployeeDetailTab {
  return EMPLOYEE_DETAIL_TABS.includes(value as EmployeeDetailTab);
}
