import { AdminOnlyGate } from '@/features/navigations/components/admin-only-gate';
import { RecruitmentPage } from '@/features/recruitment/components/recruitment-page';

export default function Page() {
  return (
    <AdminOnlyGate>
      <RecruitmentPage />
    </AdminOnlyGate>
  );
}
