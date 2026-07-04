'use client';

import { useState } from 'react';
import { ContentCard } from '@/components/content-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AttendanceTeamSessions } from '@/features/attendance/components/attendance-team-sessions';
import {
  AttendanceSummaryMonthPicker,
  AttendanceTeamSummary,
} from '@/features/attendance/components/attendance-team-summary';

export function AttendanceTeamTab() {
  const now = new Date();
  const [activeTab, setActiveTab] = useState('summary');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <ContentCard
        title="Workspace attendance"
        description="Monthly summary by member or a full session log"
        className="dashboard-panel rounded-[8px]"
        action={
          <div className="flex flex-wrap items-center justify-end gap-3">
            {activeTab === 'summary' ? (
              <AttendanceSummaryMonthPicker
                month={month}
                year={year}
                onMonthChange={setMonth}
                onYearChange={setYear}
              />
            ) : null}
            <TabsList className="inline-flex h-auto w-max flex-wrap items-center rounded-[8px] border border-slate-100 bg-white p-1 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] dark:border-slate-800 dark:bg-slate-950/75 dark:shadow-none">
              <TabsTrigger
                value="summary"
                className="rounded-[8px] px-5 py-2 text-sm font-medium text-slate-500 shadow-none data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:bg-slate-50 data-[state=active]:font-semibold data-[state=active]:text-slate-800 data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-700 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-slate-100 dark:data-[state=active]:shadow-none"
              >
                Summary
              </TabsTrigger>
              <TabsTrigger
                value="sessions"
                className="rounded-[8px] px-5 py-2 text-sm font-medium text-slate-500 shadow-none data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:bg-slate-50 data-[state=active]:font-semibold data-[state=active]:text-slate-800 data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-700 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-slate-100 dark:data-[state=active]:shadow-none"
              >
                Sessions
              </TabsTrigger>
            </TabsList>
          </div>
        }
        headerClassName="gap-4 sm:items-start"
        bodyClassName="p-0"
      >
        <TabsContent value="summary" className="mt-0">
          <AttendanceTeamSummary key={`${year}-${month}`} month={month} year={year} />
        </TabsContent>
        <TabsContent value="sessions" className="mt-0">
          <AttendanceTeamSessions />
        </TabsContent>
      </ContentCard>
    </Tabs>
  );
}
