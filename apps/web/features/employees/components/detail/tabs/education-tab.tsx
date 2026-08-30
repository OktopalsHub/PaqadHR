'use client';

import { Book, PlusCircle, Trash } from 'lucide-react';
import { useState } from 'react';
import { DestructiveConfirmDialog } from '@/components/destructive-confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import type { EmployeeDetailForm } from '../../../hooks/use-employee-detail-form';
import { EducationForm } from '../../education-form';

interface EducationTabProps {
  form: EmployeeDetailForm;
  canEdit?: boolean;
}

export function EducationTab({ form, canEdit = false }: EducationTabProps) {
  const [educationPendingDeletion, setEducationPendingDeletion] = useState<string | null>(null);
  const {
    employee,
    educationDialogOpen,
    setEducationDialogOpen,
    handleAddEducation,
    handleDeleteEducation,
  } = form;

  return (
    <TabsContent value="education" className="mt-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Education</CardTitle>
          </div>
          {canEdit ? (
            <Button variant="outline" onClick={() => setEducationDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Education
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {employee.education.map((edu) => (
            <div key={edu.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center">
                    <Book className="h-4 w-4 mr-2 text-muted-foreground" />
                    <h3 className="font-medium">{edu.degree}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{edu.institution}</p>
                </div>
                <Badge variant="outline">{edu.year}</Badge>
              </div>

              {canEdit ? (
                <div className="flex justify-end mt-4 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500"
                    onClick={() => setEducationPendingDeletion(edu.id)}
                  >
                    <Trash className="mr-2 h-3 w-3" />
                    Remove
                  </Button>
                </div>
              ) : null}
            </div>
          ))}

          {employee.education.length === 0 && (
            <div className="bg-muted/50 p-6 rounded-lg text-center">
              <p className="text-muted-foreground">No education records added</p>
              {canEdit ? (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setEducationDialogOpen(true)}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Education
                </Button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <EducationForm
        open={educationDialogOpen}
        onOpenChange={setEducationDialogOpen}
        onSubmit={handleAddEducation}
      />
      <DestructiveConfirmDialog
        open={Boolean(educationPendingDeletion)}
        onOpenChange={(open) => !open && setEducationPendingDeletion(null)}
        title="Remove education record?"
        description="This education record will be permanently deleted from the employee profile."
        actionLabel="Remove record"
        onConfirm={() => {
          if (educationPendingDeletion) handleDeleteEducation(educationPendingDeletion);
          setEducationPendingDeletion(null);
        }}
      />
    </TabsContent>
  );
}
