import type { CurrentSalary } from '@/lib/api/employment';

export function groupEmployeeIdsBySalaryCurrency(
  activeEmployeeIds: string[],
  salaries: CurrentSalary[],
  fallbackCurrency = 'USD',
): Array<{ currency: string; employeeIds: string[] }> {
  const activeIds = new Set(activeEmployeeIds);
  const map = new Map<string, string[]>();

  for (const salary of salaries) {
    if (!activeIds.has(salary.memberId)) continue;
    const currency = salary.currency?.trim().toUpperCase() || fallbackCurrency;
    const ids = map.get(currency) ?? [];
    if (!ids.includes(salary.memberId)) {
      ids.push(salary.memberId);
      map.set(currency, ids);
    }
  }

  return Array.from(map.entries())
    .map(([currency, employeeIds]) => ({ currency, employeeIds }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}
