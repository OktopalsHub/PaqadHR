import { ActivityLogPage } from '@/features/activity/components/activity-log-page';
import { AdminOnlyGate } from '@/features/navigations/components/admin-only-gate';

export default function ActivityPage() {
  return (
    <AdminOnlyGate>
      <ActivityLogPage />
    </AdminOnlyGate>
  );
}
