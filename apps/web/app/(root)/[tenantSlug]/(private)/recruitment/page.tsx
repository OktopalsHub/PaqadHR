import { AdminOnlyGate } from '@/features/navigations/components/admin-only-gate';
import { RecruitmentPipelinePage } from '@/features/recruitment/components/recruitment-pipeline-page';

export default function Page() {
  return (
    <AdminOnlyGate>
      <RecruitmentPipelinePage />
    </AdminOnlyGate>
  );
}
