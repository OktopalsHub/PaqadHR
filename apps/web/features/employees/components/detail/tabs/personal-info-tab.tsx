import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { TabsContent } from '@/components/ui/tabs';
import { GENDER_OPTIONS } from '@/lib/constants/gender';
import type { EmployeeDetailForm } from '../../../hooks/use-employee-detail-form';

interface PersonalInfoTabProps {
  form: EmployeeDetailForm;
  canEdit?: boolean;
}

export function PersonalInfoTab({ form, canEdit = false }: PersonalInfoTabProps) {
  const { employee, handleInputChange, handleNestedInputChange } = form;
  const readOnlyProps = canEdit ? {} : { readOnly: true as const, className: 'bg-muted/50' };

  return (
    <TabsContent value="personal">
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Employee's personal and contact details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first-name">First name</Label>
              <Input
                id="first-name"
                value={employee.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                {...readOnlyProps}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="middle-name">Middle name</Label>
              <Input
                id="middle-name"
                value={employee.middleName}
                onChange={(e) => handleInputChange('middleName', e.target.value)}
                placeholder="Optional"
                {...readOnlyProps}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last-name">Last name</Label>
              <Input
                id="last-name"
                value={employee.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                {...readOnlyProps}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={employee.email}
                readOnly
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={employee.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                {...readOnlyProps}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input
                id="dob"
                type="date"
                value={employee.dateOfBirth}
                onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                {...readOnlyProps}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={employee.personalInfo.gender || undefined}
                onValueChange={(value) => handleNestedInputChange('personalInfo', 'gender', value)}
                disabled={!canEdit}
              >
                <SelectTrigger id="gender" className={canEdit ? undefined : 'bg-muted/50'}>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium">Address Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="street">Street Address</Label>
                <Input
                  id="street"
                  value={employee.address.street}
                  onChange={(e) => handleNestedInputChange('address', 'street', e.target.value)}
                  {...readOnlyProps}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={employee.address.city}
                  onChange={(e) => handleNestedInputChange('address', 'city', e.target.value)}
                  {...readOnlyProps}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={employee.address.state}
                  onChange={(e) => handleNestedInputChange('address', 'state', e.target.value)}
                  {...readOnlyProps}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">Zip Code</Label>
                <Input
                  id="zip"
                  value={employee.address.zipCode}
                  onChange={(e) => handleNestedInputChange('address', 'zipCode', e.target.value)}
                  {...readOnlyProps}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={employee.address.country}
                  onChange={(e) => handleNestedInputChange('address', 'country', e.target.value)}
                  {...readOnlyProps}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
