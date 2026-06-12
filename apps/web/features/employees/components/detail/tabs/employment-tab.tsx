import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TabsContent } from "@/components/ui/tabs";
import type { EmployeeDetailForm } from "../../../hooks/use-employee-detail-form";

interface EmploymentTabProps {
  form: EmployeeDetailForm;
}

export function EmploymentTab({ form }: EmploymentTabProps) {
  const { employee, handleInputChange, handleNestedInputChange } = form;

  return (
    <TabsContent value="employment">
      <Card>
        <CardHeader>
          <CardTitle>Employment Details</CardTitle>
          <CardDescription>Job and compensation information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employee-id">Employee ID</Label>
              <Input
                id="employee-id"
                value={employee.employment.employeeId}
                readOnly
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-title">Job Title</Label>
              <Input
                id="job-title"
                value={employee.position}
                onChange={(e) => handleInputChange("position", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={employee.department}
                onChange={(e) =>
                  handleInputChange("department", e.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team">Team</Label>
              <Input
                id="team"
                value={employee.employment.team}
                onChange={(e) =>
                  handleNestedInputChange("employment", "team", e.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Employment Type</Label>
              <Input
                id="type"
                value={employee.employment.employeeType}
                onChange={(e) =>
                  handleNestedInputChange(
                    "employment",
                    "employeeType",
                    e.target.value,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="join-date">Join Date</Label>
              <Input
                id="join-date"
                type="date"
                value={employee.employment.joinDate}
                onChange={(e) =>
                  handleNestedInputChange(
                    "employment",
                    "joinDate",
                    e.target.value,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="work-location">Work Location</Label>
              <Input
                id="work-location"
                value={employee.employment.workLocation}
                onChange={(e) =>
                  handleNestedInputChange(
                    "employment",
                    "workLocation",
                    e.target.value,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reporting-to">Reports To</Label>
              <Input
                id="reporting-to"
                value={employee.employment.reportingTo}
                onChange={(e) =>
                  handleNestedInputChange(
                    "employment",
                    "reportingTo",
                    e.target.value,
                  )
                }
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium">Compensation</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="salary">Salary</Label>
                <Input
                  id="salary"
                  value={employee.compensation.salary}
                  readOnly
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pay-frequency">Pay Frequency</Label>
                <Input
                  id="pay-frequency"
                  value={employee.compensation.payFrequency}
                  readOnly
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pay-grade">Pay Grade</Label>
                <Input
                  id="pay-grade"
                  value={employee.employment.payGrade}
                  readOnly
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bonus-plan">Bonus Plan</Label>
                <Input
                  id="bonus-plan"
                  value={employee.compensation.bonusPlan}
                  readOnly
                  className="bg-muted/50"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
