'use client';

import { Cell, Pie, PieChart } from 'recharts';
import { ContentCard } from '@/components/content-card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { DepartmentChartPoint } from '../../lib/recruitment-dashboard-metrics';

const COLORS = [
  'var(--primary)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--muted-foreground)',
];

type RecruitmentDepartmentChartProps = {
  data: DepartmentChartPoint[];
};

export function RecruitmentDepartmentChart({ data }: RecruitmentDepartmentChartProps) {
  const config = Object.fromEntries(
    data.map((item, index) => [
      item.name,
      { label: item.name, color: COLORS[index % COLORS.length] },
    ]),
  );

  return (
    <ContentCard title="By department">
      <ChartContainer config={config} className="mx-auto aspect-square h-[220px]">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="mt-2 space-y-1">
        {data.slice(0, 4).map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between text-xs text-muted-foreground"
          >
            <span>{item.name}</span>
            <span className="font-medium text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    </ContentCard>
  );
}
