'use client';

import { ContentCard } from '@/components/content-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AttendanceTeamSessions } from '@/features/attendance/components/attendance-team-sessions';
import { AttendanceTeamSummary } from '@/features/attendance/components/attendance-team-summary';

export function AttendanceTeamTab() {
  return (
    <ContentCard
      title="Workspace attendance"
      description="Monthly summary by member or a full session log"
      bodyClassName="p-0"
    >
      <Tabs defaultValue="summary" className="w-full">
        <div className="border-b border-border/60 px-4 pt-3">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="summary" className="mt-0">
          <AttendanceTeamSummary />
        </TabsContent>
        <TabsContent value="sessions" className="mt-0">
          <AttendanceTeamSessions />
        </TabsContent>
      </Tabs>
    </ContentCard>
  );
}
