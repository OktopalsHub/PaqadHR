'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
} from 'recharts';
import { ContentCard } from '@/components/content-card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { AnalyticsOverview } from '@/lib/schemas/analytics';

const headcountConfig = {
  value: { label: 'Headcount', color: 'var(--chart-1)' },
};

const applicationsConfig = {
  value: { label: 'Applications', color: 'var(--chart-2)' },
};

const leaveConfig = {
  value: { label: 'Requests', color: 'var(--chart-3)' },
};

const departmentConfig = {
  memberCount: { label: 'Members', color: 'var(--chart-4)' },
};

const PIPELINE_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--muted-foreground)',
];

type AnalyticsChartsProps = {
  data: AnalyticsOverview;
};

export function AnalyticsCharts({ data }: AnalyticsChartsProps) {
  const departmentData = data.departments.slice(0, 8);
  const maxDepartmentCount = Math.max(1, ...departmentData.map((item) => item.memberCount));

  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <ContentCard
        className="xl:col-span-7"
        title="Headcount trend"
        description="Active team size over the last 6 months"
      >
        <ChartContainer config={headcountConfig} className="aspect-[16/9] h-[280px] w-full">
          <LineChart data={data.headcountTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--color-value)"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      </ContentCard>

      <ContentCard
        className="xl:col-span-5"
        title="Hiring pipeline"
        description="Candidates by current stage"
      >
        {data.recruitment.pipelineByStatus.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No candidates yet.</p>
        ) : (
          <ChartContainer config={departmentConfig} className="mx-auto aspect-square h-[280px]">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={data.recruitment.pipelineByStatus}
                dataKey="value"
                nameKey="label"
                innerRadius={56}
                outerRadius={92}
              >
                {data.recruitment.pipelineByStatus.map((entry, index) => (
                  <Cell key={entry.label} fill={PIPELINE_COLORS[index % PIPELINE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        )}
      </ContentCard>

      <ContentCard
        className="xl:col-span-6"
        title="Applications"
        description="Monthly candidate volume"
      >
        <ChartContainer config={applicationsConfig} className="aspect-[16/9] h-[260px] w-full">
          <BarChart
            data={data.recruitment.applicationsByMonth}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={4} />
          </BarChart>
        </ChartContainer>
      </ContentCard>

      <ContentCard
        className="xl:col-span-6"
        title="Leave requests"
        description="Distribution by status"
      >
        {data.leaves.byStatus.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No leave requests recorded.
          </p>
        ) : (
          <ChartContainer config={leaveConfig} className="aspect-[16/9] h-[260px] w-full">
            <BarChart data={data.leaves.byStatus} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </ContentCard>

      <ContentCard
        className="xl:col-span-12"
        title="Department headcount"
        description="Active members per department"
      >
        {departmentData.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No departments yet.</p>
        ) : (
          <div className="space-y-3">
            {departmentData.map((department) => (
              <div
                key={department.id}
                className="rounded-xl border border-border/60 bg-muted/20 p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="font-medium">{department.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {department.memberCount} member
                    {department.memberCount === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.max(6, (department.memberCount / maxDepartmentCount) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </ContentCard>
    </div>
  );
}
