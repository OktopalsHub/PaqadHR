'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchEducationRecords } from '@/lib/api/education';
import { fetchEmergencyContacts } from '@/lib/api/emergency-contacts';
import { fetchTenantMemberById } from '@/lib/api/employees';
import type { ApiTenantMember } from '@/lib/mappers/employee';
import { queryKeys } from '@/lib/query/keys';
import { useBreadcrumbTail } from '@/providers/breadcrumb-provider';
import { useTenant } from '@/providers/tenant-provider';
import { useEmployeeDetailForm } from '../hooks/use-employee-detail-form';
import { EmployeeDetailHeader } from './detail/employee-detail-header';
import { EmployeeDetailSidebar } from './detail/employee-detail-sidebar';
import { EmployeeDetailTabs } from './detail/tabs/employee-detail-tabs';

function EmployeeDetailFormView({
  member,
  memberId,
}: {
  member: ApiTenantMember;
  memberId: string;
}) {
  const { tenantId } = useTenant();
  const { data: records, isLoading: recordsLoading } = useQuery({
    queryKey: [...queryKeys.employees.detail(memberId), tenantId, 'records'],
    queryFn: async () => {
      const [emergencyContacts, education] = await Promise.all([
        fetchEmergencyContacts(memberId),
        fetchEducationRecords(memberId),
      ]);
      return { emergencyContacts, education };
    },
    enabled: Boolean(memberId) && Boolean(tenantId),
  });

  if (recordsLoading || !records) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <EmployeeDetailFormReady
      member={member}
      emergencyContacts={records.emergencyContacts}
      education={records.education}
    />
  );
}

function EmployeeDetailFormReady({
  member,
  emergencyContacts,
  education,
}: {
  member: ApiTenantMember;
  emergencyContacts: Awaited<ReturnType<typeof fetchEmergencyContacts>>;
  education: Awaited<ReturnType<typeof fetchEducationRecords>>;
}) {
  const form = useEmployeeDetailForm(member, { emergencyContacts, education });

  return (
    <div className="space-y-6">
      <EmployeeDetailHeader
        isDirty={form.isDirty}
        isSaving={form.isSaving}
        onSave={form.handleSaveChanges}
      />

      <div className="flex flex-col md:flex-row gap-6">
        <EmployeeDetailSidebar employee={form.employee} onInputChange={form.handleInputChange} />
        <EmployeeDetailTabs form={form} />
      </div>
    </div>
  );
}

const EmployeeDetail = () => {
  const { employeeID: id } = useParams<{ employeeID: string }>();
  const { tenantId } = useTenant();
  const {
    data: member,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: [...queryKeys.employees.detail(id ?? ''), tenantId, 'member'],
    queryFn: () => fetchTenantMemberById(id!),
    enabled: Boolean(id) && Boolean(tenantId),
  });

  const displayName = member
    ? [member.firstName, member.lastName].filter(Boolean).join(' ') || member.preferredName
    : null;

  useBreadcrumbTail(displayName ?? null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError || !member) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load employee</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Employee not found'}
        </AlertDescription>
      </Alert>
    );
  }

  return <EmployeeDetailFormView key={member.id} member={member} memberId={member.id} />;
};

export default EmployeeDetail;
