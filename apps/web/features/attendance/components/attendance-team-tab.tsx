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
        className="dashboard-panel rounded-[8px]"
        action={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:flex-nowrap">
            <div className="overflow-x-auto pb-1 sm:pb-0">
              <TabsList className="app-segmented-control">
                <TabsTrigger value="summary" className="app-segmented-trigger">
                  Summary
                </TabsTrigger>
                <TabsTrigger value="sessions" className="app-segmented-trigger">
                  Sessions
                </TabsTrigger>
              </TabsList>
            </div>
            {activeTab === 'summary' ? (
              <AttendanceSummaryMonthPicker
                month={month}
                year={year}
                onMonthChange={setMonth}
                onYearChange={setYear}
              />
            ) : null}
          </div>
        }
        headerClassName="gap-4 sm:items-center"
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
