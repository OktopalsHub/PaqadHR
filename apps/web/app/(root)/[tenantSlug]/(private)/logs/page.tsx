import { ActivityLogPage } from '@/features/activity/components/activity-log-page';
import { AdminOnlyGate } from '@/features/navigations/components/admin-only-gate';

export default function LogsPage() {
  return (
    <AdminOnlyGate>
      <ActivityLogPage />
    </AdminOnlyGate>
  );
}
