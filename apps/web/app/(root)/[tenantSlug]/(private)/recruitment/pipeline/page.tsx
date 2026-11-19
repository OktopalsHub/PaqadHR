import { AdminOnlyGate } from '@/features/navigations/components/admin-only-gate';
import { RecruitmentPipelineSettingsPage } from '@/features/recruitment/components/recruitment-pipeline-settings-page';

export default function Page() {
  return (
    <AdminOnlyGate>
      <RecruitmentPipelineSettingsPage />
    </AdminOnlyGate>
  );
}
