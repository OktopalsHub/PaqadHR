import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmployeeDetailState } from "../../lib/employee-detail-state";

interface EmployeeDetailSidebarProps {
  employee: EmployeeDetailState;
  onInputChange: (field: string, value: string) => void;
}

export function EmployeeDetailSidebar({
  employee,
  onInputChange,
}: EmployeeDetailSidebarProps) {
  return (
    <div className="md:w-1/3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{employee.name}</CardTitle>
            <CardDescription>{employee.position}</CardDescription>
          </div>
          <Badge variant={employee.status === "Active" ? "default" : "outline"}>
            {employee.status}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          <Avatar className="h-32 w-32">
            {employee.profileImage ? (
              <AvatarImage src={employee.profileImage} alt={employee.name} />
            ) : (
              <AvatarFallback className="text-4xl">
                {employee.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            )}
          </Avatar>

          <div className="space-y-4 w-full">
            <div className="space-y-2">
              <Label htmlFor="preferred-name">Preferred Name (Optional)</Label>
              <Input
                id="preferred-name"
                value={employee.preferredName}
                onChange={(e) => onInputChange("preferredName", e.target.value)}
                placeholder="Enter preferred name"
              />
            </div>

            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <span className="text-sm font-medium text-muted-foreground">ID:</span>
              <span>{employee.employment.employeeId}</span>
              <span className="text-sm font-medium text-muted-foreground">Dept:</span>
              <span>{employee.department}</span>
              <span className="text-sm font-medium text-muted-foreground">Email:</span>
              <span className="break-all">{employee.email}</span>
              <span className="text-sm font-medium text-muted-foreground">Phone:</span>
              <span>{employee.phone}</span>
              <span className="text-sm font-medium text-muted-foreground">Manager:</span>
              <span>{employee.manager}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
