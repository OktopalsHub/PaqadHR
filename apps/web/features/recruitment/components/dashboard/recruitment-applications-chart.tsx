'use client';

import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { ContentCard } from '@/components/content-card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ApplicationsChartPoint } from '../../lib/recruitment-dashboard-metrics';

const chartConfig = {
  applied: { label: 'Applied', color: 'var(--primary)' },
  shortlisted: { label: 'Shortlisted', color: 'var(--muted-foreground)' },
};

type RecruitmentApplicationsChartProps = {
  data: ApplicationsChartPoint[];
};

export function RecruitmentApplicationsChart({ data }: RecruitmentApplicationsChartProps) {
  return (
    <ContentCard title="Applications" description="Applied vs shortlisted">
      <ChartContainer config={chartConfig} className="aspect-[16/9] h-[260px] w-full">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="applied" fill="var(--color-applied)" radius={4} />
          <Bar dataKey="shortlisted" fill="var(--color-shortlisted)" radius={4} />
        </BarChart>
      </ChartContainer>
    </ContentCard>
  );
}
