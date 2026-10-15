import { Analytics } from '@/features/analytics/components/analytics';
import { AdminOnlyGate } from '@/features/navigations/components/admin-only-gate';

export default function AnalyticsPage() {
  return (
    <AdminOnlyGate>
      <Analytics />
    </AdminOnlyGate>
  );
}
