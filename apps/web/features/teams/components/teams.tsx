"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Building, Network, Plus, Search } from "lucide-react";
import { useDepartments } from "@/hooks/queries/use-departments";
import { DepartmentCard } from "./department-card";
import { OrgChartView } from "./org-chart-view";

export const Teams = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedDepts, setExpandedDepts] = useState<string[]>([]);
  const { data: departments = [], isLoading, isError, error } = useDepartments();

  const filteredDepartments = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return departments.filter(
      (dept) =>
        dept.name.toLowerCase().includes(term) ||
        (dept.description?.toLowerCase().includes(term) ?? false) ||
        dept.members.some(
          (member) =>
            member.name.toLowerCase().includes(term) ||
            (member.role?.toLowerCase().includes(term) ?? false),
        ),
    );
  }, [departments, searchTerm]);

  const toggleDepartment = (deptId: string) => {
    setExpandedDepts((prev) =>
      prev.includes(deptId)
        ? prev.filter((id) => id !== deptId)
        : [...prev, deptId],
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Teams & Departments</h1>
          <p className="text-muted-foreground mt-1">
            Manage your organization structure and team members
          </p>
        </div>
        <Button className="gap-2">
          <Plus size={18} />
          Add Employee
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load departments</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Something went wrong"}
          </AlertDescription>
        </Alert>
      ) : (
        <Tabs defaultValue="departments" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="departments" className="gap-2">
              <Building size={16} />
              Departments
            </TabsTrigger>
            <TabsTrigger value="org-chart" className="gap-2">
              <Network size={16} />
              Organization Chart
            </TabsTrigger>
          </TabsList>

          <TabsContent value="departments" className="space-y-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search departments, employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="space-y-4">
              {filteredDepartments.map((dept) => (
                <DepartmentCard
                  key={dept.id}
                  department={dept}
                  isExpanded={expandedDepts.includes(dept.id)}
                  onToggle={() => toggleDepartment(dept.id)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="org-chart">
            <OrgChartView departments={departments} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
