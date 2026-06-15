import { Briefcase, CheckCircle2, UserCheck, UserX } from 'lucide-react';
import { StatCard } from '@/components/stat-card';
import { cn } from '@/lib/utils';
import type { RecruitmentKpis } from '../../lib/recruitment-dashboard-metrics';

type RecruitmentKpiRowProps = {
  kpis: RecruitmentKpis;
};

export function RecruitmentKpiRow({ kpis }: RecruitmentKpiRowProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Applications"
        value={kpis.applications.toLocaleString()}
        icon={Briefcase}
        trend={kpis.trends.applications}
        className={cn('border-primary/30 bg-primary/5')}
      />
      <StatCard
        label="Shortlisted"
        value={kpis.shortlisted.toLocaleString()}
        icon={UserCheck}
        trend={kpis.trends.shortlisted}
      />
      <StatCard
        label="Hired"
        value={kpis.hired.toLocaleString()}
        icon={CheckCircle2}
        trend={kpis.trends.hired}
      />
      <StatCard
        label="Rejected"
        value={kpis.rejected.toLocaleString()}
        icon={UserX}
        trend={kpis.trends.rejected}
      />
    </div>
  );
}
