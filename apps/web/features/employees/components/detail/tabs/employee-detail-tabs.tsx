'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUrlTab } from '@/hooks/use-url-tab';
import type { EmployeeDetailForm } from '../../../hooks/use-employee-detail-form';
import { type EmployeeDetailTab, isEmployeeDetailTab } from '../../../lib/employee-detail-tabs';
import { DocumentsTab } from './documents-tab';
import { EducationTab } from './education-tab';
import { EmergencyContactsTab } from './emergency-contacts-tab';
import { EmploymentTab } from './employment-tab';
import { PersonalInfoTab } from './personal-info-tab';

interface EmployeeDetailTabsProps {
  form: EmployeeDetailForm;
  memberId: string;
  viewerMemberId?: string;
  isAdmin?: boolean;
  canEdit?: boolean;
}

export function EmployeeDetailTabs({
  form,
  memberId,
  viewerMemberId,
  isAdmin = false,
  canEdit = false,
}: EmployeeDetailTabsProps) {
  const [activeTab, setTab] = useUrlTab(isEmployeeDetailTab, 'personal');
  const isSelf = viewerMemberId === memberId;

  return (
    <div className="md:w-2/3">
      <Tabs value={activeTab} onValueChange={(value) => setTab(value as EmployeeDetailTab)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="emergency">Emergency</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="education">Education</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <PersonalInfoTab form={form} canEdit={canEdit} />
        <EmergencyContactsTab form={form} canEdit={canEdit} />
        <EmploymentTab
          form={form}
          memberId={memberId}
          isAdmin={isAdmin}
          canViewCompensation={isAdmin || isSelf}
        />
        <EducationTab form={form} canEdit={canEdit} />
        <DocumentsTab memberId={memberId} isSelf={isSelf} isAdmin={isAdmin} />
      </Tabs>
    </div>
  );
}
