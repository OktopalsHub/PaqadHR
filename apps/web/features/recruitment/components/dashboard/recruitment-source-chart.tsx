'use client';

import { Cell, Pie, PieChart } from 'recharts';
import { ContentCard } from '@/components/content-card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { SourceChartPoint } from '../../lib/recruitment-dashboard-metrics';

const COLORS = ['var(--primary)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];

type RecruitmentSourceChartProps = {
  data: SourceChartPoint[];
  total?: number;
};

export function RecruitmentSourceChart({ data, total }: RecruitmentSourceChartProps) {
  const sum = total ?? data.reduce((acc, item) => acc + item.value, 0);
  const config = Object.fromEntries(
    data.map((item, index) => [
      item.name,
      { label: item.name, color: COLORS[index % COLORS.length] },
    ]),
  );

  return (
    <ContentCard title="Applicant sources">
      <div className="relative">
        <ChartContainer config={config} className="mx-auto aspect-square h-[220px]">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xl font-semibold">{sum.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </div>
        </div>
      </div>
      <div className="mt-2 space-y-1">
        {data.map((item) => (
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
