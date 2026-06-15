import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { EmployeeDetailForm } from '../../../hooks/use-employee-detail-form';
import { DocumentsTab } from './documents-tab';
import { EducationTab } from './education-tab';
import { EmergencyContactsTab } from './emergency-contacts-tab';
import { EmploymentTab } from './employment-tab';
import { PersonalInfoTab } from './personal-info-tab';

interface EmployeeDetailTabsProps {
  form: EmployeeDetailForm;
}

export function EmployeeDetailTabs({ form }: EmployeeDetailTabsProps) {
  return (
    <div className="md:w-2/3">
      <Tabs defaultValue="personal">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="emergency">Emergency Contacts</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="education">Education</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <PersonalInfoTab form={form} />
        <EmergencyContactsTab form={form} />
        <EmploymentTab form={form} />
        <EducationTab form={form} />
        <DocumentsTab form={form} />
      </Tabs>
    </div>
  );
}
