'use client';

import { Kanban, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { PageActions } from '@/components/page-actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { useRecruitmentOverview } from '../hooks/use-recruitment-overview';
import { CreateJobDialog } from './create-job-dialog';
import { RecruitmentApplicationsChart } from './dashboard/recruitment-applications-chart';
import { RecruitmentDepartmentChart } from './dashboard/recruitment-department-chart';
import { RecruitmentKpiRow } from './dashboard/recruitment-kpi-row';
import { RecruitmentSourceChart } from './dashboard/recruitment-source-chart';

export function RecruitmentPage() {
  const tenantHref = useTenantHref();
  const [createOpen, setCreateOpen] = useState(false);
  const { overview, isLoading, jobsError, jobsErrorObj } = useRecruitmentOverview();

  if (isLoading) {
    return (
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  if (jobsError) {
    return (
      <AppPage>
        <Alert variant="destructive">
          <AlertTitle>Unable to load recruitment</AlertTitle>
          <AlertDescription>
            {jobsErrorObj instanceof Error ? jobsErrorObj.message : 'Something went wrong'}
          </AlertDescription>
        </Alert>
      </AppPage>
    );
  }

  return (
    <AppPage className="space-y-5">
      <PageActions>
        <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" asChild>
          <Link href={tenantHref('recruitment')}>
            <Kanban className="mr-1.5 size-3.5" />
            Pipeline
          </Link>
        </Button>
        <Button size="sm" className="h-8 rounded-lg text-xs" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 size-3.5" />
          New role
        </Button>
      </PageActions>

      <RecruitmentKpiRow kpis={overview.kpis} />

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecruitmentApplicationsChart data={overview.applicationsChart} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
          <RecruitmentDepartmentChart data={overview.departmentChart} />
          <RecruitmentSourceChart data={overview.sourceChart} />
        </div>
      </div>

      <CreateJobDialog open={createOpen} onOpenChange={setCreateOpen} />
    </AppPage>
  );
}
