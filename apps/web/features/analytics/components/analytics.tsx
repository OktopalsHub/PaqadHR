"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyAnalytics } from "./company-analytics";
import { ReportsGenerator } from "./reports-generator";
import { TeamManagement } from "@/components/team-management";
import { LearningAnalytics } from "./learning-analytics";

export const Analytics = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics & Reports</h1>
        <p className="text-muted-foreground mt-1">
          Comprehensive insights into your organization
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="learning">Learning</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <CompanyAnalytics />
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          <TeamManagement />
        </TabsContent>

        <TabsContent value="learning" className="space-y-6">
          <LearningAnalytics />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <ReportsGenerator />
        </TabsContent>
      </Tabs>
    </div>
  );
};
