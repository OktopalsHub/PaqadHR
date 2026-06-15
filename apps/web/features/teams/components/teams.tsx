"use client";

import { useMemo, useState } from "react";
import { AppPage } from "@/components/app-page";
import { EmptyState } from "@/components/empty-state";
import { LoadingBlock } from "@/components/loading-block";
import { PageActions } from "@/components/page-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Building2, Plus, Search } from "lucide-react";
import { useDepartments } from "@/hooks/queries/use-departments";
import { CreateDepartmentDialog } from "./create-department-dialog";
import { DepartmentCard } from "./department-card";

export const Teams = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
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

  if (isLoading) {
    return (
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  return (
    <AppPage>
      <PageActions>
        <Button
          className="gap-2 rounded-lg"
          size="sm"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={16} />
          Add department
        </Button>
      </PageActions>

      <CreateDepartmentDialog open={createOpen} onOpenChange={setCreateOpen} />

      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load departments</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Something went wrong"}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search departments or members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-lg pl-9"
            />
          </div>

          {departments.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No departments yet"
              description="Create your first department to organize teams and members."
            />
          ) : filteredDepartments.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No matches"
              description="Try a different search term."
            />
          ) : (
            <div className="grid gap-4">
              {filteredDepartments.map((dept) => (
                <DepartmentCard
                  key={dept.id}
                  department={dept}
                  isExpanded={expandedDepts.includes(dept.id)}
                  onToggle={() => toggleDepartment(dept.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </AppPage>
  );
};
