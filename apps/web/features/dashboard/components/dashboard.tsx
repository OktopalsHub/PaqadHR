"use client";

import Link from "next/link";
import { ArrowUpRight, Briefcase, CalendarClock, Users } from "lucide-react";
import { AppPage } from "@/components/app-page";
import { ContentCard } from "@/components/content-card";
import { LoadingBlock } from "@/components/loading-block";
import { PageActions } from "@/components/page-actions";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEmployees } from "@/hooks/queries/use-employees";
import { useLeaves } from "@/hooks/queries/use-leaves";
import { useJobOpenings } from "@/hooks/queries/use-recruitment";
import { formatDate } from "@/lib/format-date";
import { useAuth } from "@/hooks/use-auth";
import {
  memberPreferredOrFirstName,
  useMemberProfile,
} from "@/hooks/queries/use-member-profile";

function leaveStatusVariant(status: string) {
  switch (status.toLowerCase()) {
    case "approved":
      return "default";
    case "pending":
      return "secondary";
    case "rejected":
      return "destructive";
    default:
      return "outline";
  }
}

export const Dashboard = () => {
  const { user } = useAuth();
  const { data: profile } = useMemberProfile();
  const { data: employees = [], isLoading: employeesLoading } = useEmployees();
  const { data: leaves = [], isLoading: leavesLoading } = useLeaves();
  const { data: jobsData, isLoading: jobsLoading } = useJobOpenings();

  const isLoading = employeesLoading || leavesLoading || jobsLoading;
  const jobs = jobsData?.jobs ?? [];
  const openRoles = jobs.filter((j) => j.status === "ACTIVE").length;
  const pendingLeaves = leaves.filter(
    (l) => l.status?.toLowerCase() === "pending",
  ).length;
  const recentLeaves = [...leaves]
    .sort(
      (a, b) =>
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
    )
    .slice(0, 6);

  const dashboardTitle = memberPreferredOrFirstName(profile, user?.name);
  const departmentCount = new Set(
    employees.map((e) => e.department).filter(Boolean),
  ).size;
  const activeJobs = jobs.filter((j) => j.status === "ACTIVE").slice(0, 4);
  const pipelineStages = [
    { label: "Active", count: jobs.filter((j) => j.status === "ACTIVE").length },
    { label: "Draft", count: jobs.filter((j) => j.status === "DRAFT").length },
    { label: "Closed", count: jobs.filter((j) => j.status === "CLOSED").length },
    { label: "Archived", count: jobs.filter((j) => j.status === "ARCHIVED").length },
  ];
  const pipelineMax = Math.max(1, ...pipelineStages.map((s) => s.count));

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
        <Button asChild size="sm" className="h-8 rounded-lg text-xs">
          <Link href="/app/recruitment">
            View hiring pipeline
            <ArrowUpRight className="ml-1.5 size-3.5" />
          </Link>
        </Button>
      </PageActions>

      <p className="text-sm text-muted-foreground">
        Welcome back, {dashboardTitle}.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Headcount"
          value={employees.length}
          hint="Active employees"
          icon={Users}
        />
        <StatCard
          label="Open roles"
          value={openRoles}
          hint={`${jobs.length} total postings`}
          icon={Briefcase}
        />
        <StatCard
          label="Pending leave"
          value={pendingLeaves}
          hint={`${leaves.length} requests total`}
          icon={CalendarClock}
        />
        <StatCard
          label="Departments"
          value={departmentCount || "—"}
          hint="With assigned members"
          icon={Users}
          iconClassName="bg-chart-2/15 text-chart-2"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <ContentCard
          className="xl:col-span-8"
          title="Recent leave requests"
          action={
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
              <Link href="/app/leaves">View all</Link>
            </Button>
          }
          bodyClassName="p-0"
        >
          {recentLeaves.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No leave requests yet.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {recentLeaves.map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {leave.employee}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {leave.type} · {formatDate(leave.startDate)} –{" "}
                      {formatDate(leave.endDate)}
                    </p>
                  </div>
                  <Badge variant={leaveStatusVariant(leave.status ?? "pending")}>
                    {leave.status ?? "Pending"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </ContentCard>

        <ContentCard
          className="xl:col-span-4"
          title="Active openings"
          action={
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
              <Link href="/app/recruitment">Manage</Link>
            </Button>
          }
          bodyClassName="space-y-2 p-3"
        >
          {activeJobs.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">
              No active roles published.
            </p>
          ) : (
            activeJobs.map((job) => (
              <div
                key={job.id}
                className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
              >
                <p className="text-sm font-medium">{job.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[job.departmentName, job.employmentType]
                    .filter(Boolean)
                    .join(" · ") || "No department"}
                </p>
              </div>
            ))
          )}
        </ContentCard>
      </div>

      {jobs.length > 0 ? (
        <ContentCard title="Hiring pipeline" bodyClassName="p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {pipelineStages.map((stage) => (
              <div
                key={stage.label}
                className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {stage.label}
                </p>
                <p className="mt-1 text-xl font-semibold">{stage.count}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex h-20 items-end gap-2 border-b border-border/60 pb-1">
            {pipelineStages.map((stage) => {
              const height = Math.max(8, (stage.count / pipelineMax) * 100);
              return (
                <div
                  key={stage.label}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <div
                    className="w-full max-w-8 rounded-t-md bg-primary/70"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </ContentCard>
      ) : null}
    </AppPage>
  );
};
