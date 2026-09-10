'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTenantSettings } from '@/hooks/queries/use-tenant-settings';
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
  canManageOrganization?: boolean;
  canEditPersonal?: boolean;
}

export function EmployeeDetailTabs({
  form,
  memberId,
  viewerMemberId,
  isAdmin = false,
  canManageOrganization = false,
  canEditPersonal = false,
}: EmployeeDetailTabsProps) {
  const [activeTab, setTab] = useUrlTab(isEmployeeDetailTab, 'personal');
  const isSelf = viewerMemberId === memberId;
  const { data: settings } = useTenantSettings();
  const requireIdentityForPayroll =
    settings?.settings?.employee?.requireIdentityForPayroll === true;
  const showIdentitySection = isSelf && requireIdentityForPayroll;

  return (
    <div className="min-w-0 xl:w-2/3">
      <Tabs value={activeTab} onValueChange={(value) => setTab(value as EmployeeDetailTab)}>
        <TabsList
          aria-label="Employee detail sections"
          className="grid h-auto w-full grid-cols-5 rounded-md border border-border/70 bg-white p-1.5 shadow-sm dark:bg-card max-xl:flex max-xl:justify-start max-xl:overflow-x-auto"
        >
          <TabsTrigger
            value="personal"
            className="h-10 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none max-xl:min-w-28"
          >
            Personal
          </TabsTrigger>
          <TabsTrigger
            value="emergency"
            className="h-10 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none max-xl:min-w-28"
          >
            Emergency
          </TabsTrigger>
          <TabsTrigger
            value="employment"
            className="h-10 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none max-xl:min-w-28"
          >
            Employment
          </TabsTrigger>
          <TabsTrigger
            value="education"
            className="h-10 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none max-xl:min-w-28"
          >
            Education
          </TabsTrigger>
          <TabsTrigger
            value="documents"
            className="h-10 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none max-xl:min-w-28"
          >
            Documents
          </TabsTrigger>
        </TabsList>

        <PersonalInfoTab
          form={form}
          canEdit={canEditPersonal}
          showIdentitySection={showIdentitySection}
        />
        <EmergencyContactsTab form={form} canEdit={canEditPersonal} />
        <EmploymentTab
          form={form}
          memberId={memberId}
          isAdmin={isAdmin}
          canManageOrganization={canManageOrganization}
          canViewCompensation={isAdmin || isSelf}
        />
        <EducationTab form={form} canEdit={canEditPersonal} />
        <DocumentsTab memberId={memberId} isSelf={isSelf} isAdmin={isAdmin} />
      </Tabs>
    </div>
  );
}
