import { Button } from "@/components/ui/button";

type EmployeeDetailHeaderProps = {
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
};

export function EmployeeDetailHeader({
  isDirty,
  isSaving,
  onSave,
}: EmployeeDetailHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-3xl font-bold tracking-tight">Employee Details</h2>
        <p className="text-muted-foreground">
          View and update employee information from your workspace
        </p>
      </div>
      <Button
        size="sm"
        disabled={!isDirty || isSaving}
        onClick={onSave}
      >
        {isSaving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
