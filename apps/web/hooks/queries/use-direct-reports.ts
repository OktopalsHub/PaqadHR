import { isTenantAdmin, resolveViewerDirectReportsCount } from '@/lib/auth/manager-access';
import { useTenant } from '@/providers/tenant-provider';

import { useEmployees } from './use-employees';

/**
 * How many people report to the viewer. Admins never need it and the session
 * carries it for everyone else, so the full member list loads only as a fallback.
 */
export function useViewerDirectReportsCount(): number {
  const { tenant } = useTenant();
  const member = tenant?.member;
  const needsMemberList =
    Boolean(member) &&
    !isTenantAdmin(member?.role) &&
    typeof member?.directReportsCount !== 'number';
  const { data: employees } = useEmployees({ enabled: needsMemberList });
  return resolveViewerDirectReportsCount(member, employees);
}

export function useViewerHasDirectReports(): boolean {
  return useViewerDirectReportsCount() > 0;
}
