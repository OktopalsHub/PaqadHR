import { PlusCircle, Trash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import type { EmployeeDetailForm } from '../../../hooks/use-employee-detail-form';
import { EmergencyContactForm } from '../../emergency-contact-form';

interface EmergencyContactsTabProps {
  form: EmployeeDetailForm;
  canEdit?: boolean;
}

export function EmergencyContactsTab({ form, canEdit = false }: EmergencyContactsTabProps) {
  const {
    employee,
    emergencyContactDialogOpen,
    setEmergencyContactDialogOpen,
    handleAddEmergencyContact,
    handleDeleteEmergencyContact,
  } = form;

  return (
    <TabsContent value="emergency">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Emergency Contacts</CardTitle>
          </div>
          {canEdit ? (
            <Button variant="outline" onClick={() => setEmergencyContactDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Contact
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {employee.emergencyContacts.map((contact) => (
            <div key={contact.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{contact.name}</h3>
                  <p className="text-sm text-muted-foreground">{contact.relationship}</p>
                </div>
                {contact.isEmergencyContact && <Badge>Primary Contact</Badge>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <p>{contact.phone}</p>
                </div>
                {contact.email && (
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p>{contact.email}</p>
                  </div>
                )}
              </div>

              {contact.address && (
                <div className="mt-4">
                  <p className="text-sm font-medium">Address</p>
                  <p className="text-sm">{contact.address}</p>
                </div>
              )}

              {canEdit ? (
                <div className="flex justify-end mt-4 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500"
                    onClick={() => handleDeleteEmergencyContact(contact.id)}
                  >
                    <Trash className="mr-2 h-3 w-3" />
                    Remove
                  </Button>
                </div>
              ) : null}
            </div>
          ))}

          {employee.emergencyContacts.length === 0 && (
            <div className="bg-muted/50 p-6 rounded-lg text-center">
              <p className="text-muted-foreground">No emergency contacts added</p>
              {canEdit ? (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setEmergencyContactDialogOpen(true)}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Emergency Contact
                </Button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <EmergencyContactForm
        open={emergencyContactDialogOpen}
        onOpenChange={setEmergencyContactDialogOpen}
        onSubmit={handleAddEmergencyContact}
      />
    </TabsContent>
  );
}
