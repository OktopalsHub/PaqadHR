import { AdminOnlyGate } from '@/features/navigations/components/admin-only-gate';
import { RecruitmentAnalyticsPage } from '@/features/recruitment/components/recruitment-analytics-page';

export default function Page() {
  return (
    <AdminOnlyGate>
      <RecruitmentAnalyticsPage />
    </AdminOnlyGate>
  );
}
