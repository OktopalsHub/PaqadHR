import { AdminOnlyGate } from '@/features/navigations/components/admin-only-gate';
import { RecruitmentTemplatesPage } from '@/features/recruitment/components/recruitment-templates-page';

export default function Page() {
  return (
    <AdminOnlyGate>
      <RecruitmentTemplatesPage />
    </AdminOnlyGate>
  );
}
