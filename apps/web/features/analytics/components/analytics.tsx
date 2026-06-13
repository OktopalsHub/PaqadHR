"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppPage } from "@/components/app-page";
import { CompanyAnalytics } from "./company-analytics";
import { ReportsGenerator } from "./reports-generator";
import { TeamManagement } from "@/components/team-management";
import { LearningAnalytics } from "./learning-analytics";

export const Analytics = () => {
  return (
    <AppPage>
      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="grid h-11 w-full max-w-2xl grid-cols-4 rounded-xl">
          <TabsTrigger value="overview" className="rounded-lg">
            Overview
          </TabsTrigger>
          <TabsTrigger value="teams" className="rounded-lg">
            Teams
          </TabsTrigger>
          <TabsTrigger value="learning" className="rounded-lg">
            Learning
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-lg">
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <CompanyAnalytics />
        </TabsContent>

        <TabsContent value="teams" className="space-y-5">
          <TeamManagement />
        </TabsContent>

        <TabsContent value="learning" className="space-y-5">
          <LearningAnalytics />
        </TabsContent>

        <TabsContent value="reports" className="space-y-5">
          <ReportsGenerator />
        </TabsContent>
      </Tabs>
    </AppPage>
  );
};
