import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Book, Pencil, PlusCircle, Trash } from "lucide-react";
import { EducationForm } from "../../education-form";
import type { EmployeeDetailForm } from "../../../hooks/use-employee-detail-form";

interface EducationTabProps {
  form: EmployeeDetailForm;
}

export function EducationTab({ form }: EducationTabProps) {
  const {
    employee,
    educationDialogOpen,
    setEducationDialogOpen,
    handleAddEducation,
  } = form;

  return (
    <TabsContent value="education">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Education</CardTitle>
            <CardDescription>
              Employee's educational background
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={() => setEducationDialogOpen(true)}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Education
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {employee.education.map((edu, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center">
                    <Book className="h-4 w-4 mr-2 text-muted-foreground" />
                    <h3 className="font-medium">{edu.degree}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {edu.institution}
                  </p>
                </div>
                <Badge variant="outline">{edu.year}</Badge>
              </div>

              <div className="flex justify-end mt-4 gap-2">
                <Button variant="outline" size="sm">
                  <Pencil className="mr-2 h-3 w-3" />
                  Edit
                </Button>
                <Button variant="ghost" size="sm" className="text-red-500">
                  <Trash className="mr-2 h-3 w-3" />
                  Remove
                </Button>
              </div>
            </div>
          ))}

          {employee.education.length === 0 && (
            <div className="bg-muted/50 p-6 rounded-lg text-center">
              <p className="text-muted-foreground">
                No education records added
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setEducationDialogOpen(true)}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Education
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <EducationForm
        open={educationDialogOpen}
        onOpenChange={setEducationDialogOpen}
        onSubmit={handleAddEducation}
      />
    </TabsContent>
  );
}
