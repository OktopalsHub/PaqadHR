import { AdminOnlyGate } from '@/features/navigations/components/admin-only-gate';
import { RecruitmentTalentPoolPage } from '@/features/recruitment/components/recruitment-talent-pool-page';

export default function Page() {
  return (
    <AdminOnlyGate>
      <RecruitmentTalentPoolPage />
    </AdminOnlyGate>
  );
}
