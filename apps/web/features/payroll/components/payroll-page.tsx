"use client";

import { useState } from "react";
import { Download, FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { LoadingBlock } from "@/components/loading-block";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useEmployees } from "@/hooks/queries/use-employees";
import {
  useCreatePayrollRun,
  usePayrollActions,
  usePayrollRuns,
} from "@/hooks/queries/use-payroll";
import type { PayrollRun } from "@/lib/schemas/payroll";
import { formatDate } from "@/lib/format-date";

function statusVariant(status: string) {
  switch (status) {
    case "completed":
      return "default";
    case "approved":
      return "secondary";
    case "processing":
      return "outline";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

function PayrollRunRow({
  run,
  onAction,
  busy,
}: {
  run: PayrollRun;
  onAction: (action: string, id: string) => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{run.title}</p>
          <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDate(run.periodStart)} – {formatDate(run.periodEnd)} ·{" "}
          {run.baseCurrency}
          {run.totalNetAmount != null
            ? ` · Net ${Number(run.totalNetAmount).toLocaleString()}`
            : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {run.status === "draft" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onAction("calculate", run.id)}
          >
            Calculate
          </Button>
        ) : null}
        {run.status === "processing" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onAction("approve", run.id)}
          >
            Approve
          </Button>
        ) : null}
        {run.status === "approved" ? (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => onAction("disburse", run.id)}
          >
            Mark paid
          </Button>
        ) : null}
        {["processing", "approved", "completed"].includes(run.status) ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onAction("export", run.id)}
          >
            <Download className="mr-1 size-4" />
            CSV
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function PayrollPage() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const paymentDate = new Date(now.getFullYear(), now.getMonth() + 1, 5);

  const { data: employees = [] } = useEmployees();
  const { data, isLoading, isError, error } = usePayrollRuns();
  const createRun = useCreatePayrollRun();
  const actions = usePayrollActions();

  const busy =
    createRun.isPending ||
    actions.calculate.isPending ||
    actions.approve.isPending ||
    actions.disburse.isPending ||
    actions.exportCsv.isPending;

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Enter a payroll title");
      return;
    }
    const activeIds = employees
      .filter((e) => e.status === "Active")
      .map((e) => e.id);
    if (!activeIds.length) {
      toast.error("No active employees to include");
      return;
    }
    try {
      await createRun.mutateAsync({
        title: title.trim(),
        frequency: "monthly",
        periodStart: monthStart.toISOString(),
        periodEnd: monthEnd.toISOString(),
        paymentDate: paymentDate.toISOString(),
        baseCurrency: "NGN",
        employeeIds: activeIds,
      });
      setOpen(false);
      setTitle("");
      toast.success("Payroll run created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create run");
    }
  };

  const handleAction = async (action: string, id: string) => {
    try {
      if (action === "calculate") await actions.calculate.mutateAsync(id);
      if (action === "approve") await actions.approve.mutateAsync(id);
      if (action === "disburse") await actions.disburse.mutateAsync(id);
      if (action === "export") await actions.exportCsv.mutateAsync(id);
      toast.success(`Payroll ${action} completed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  if (isLoading) return <LoadingBlock />;

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load payroll</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : "Something went wrong"}
        </AlertDescription>
      </Alert>
    );
  }

  const runs = data?.runs ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Payroll"
        description="Create runs, export bank files, and mark salaries paid offline."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 size-4" />
                New run
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create payroll run</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    placeholder="March 2026 payroll"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Includes {employees.filter((e) => e.status === "Active").length}{" "}
                  active employees for the current month.
                </p>
                <Button
                  className="w-full"
                  disabled={createRun.isPending}
                  onClick={handleCreate}
                >
                  Create run
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {runs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No payroll runs"
          description="Create a run to calculate salaries and export a bank file."
        />
      ) : (
        <div className="space-y-4">
          {runs.map((run) => (
            <PayrollRunRow
              key={run.id}
              run={run}
              busy={busy}
              onAction={handleAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
