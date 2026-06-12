import { Button } from "@/components/ui/button";

interface EmployeeDetailHeaderProps {
  isDirty: boolean;
  onSave: () => void;
}

export function EmployeeDetailHeader({
  isDirty,
  onSave,
}: EmployeeDetailHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <h2 className="text-3xl font-bold tracking-tight">Employee Details</h2>
        <p className="text-muted-foreground">
          View and manage employee information
        </p>
      </div>
      <div className="flex gap-2">
        {isDirty && (
          <Button onClick={onSave} variant="default">
            Save Changes
          </Button>
        )}
      </div>
    </div>
  );
}
