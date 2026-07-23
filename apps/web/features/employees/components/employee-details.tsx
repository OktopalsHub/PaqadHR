'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useUpdateEmployeeMemberStatus } from '@/hooks/queries/use-employees';
import { fetchMemberAddress } from '@/lib/api/address';
import { fetchEducationRecords } from '@/lib/api/education';
import { fetchEmergencyContacts } from '@/lib/api/emergency-contacts';
import { fetchTenantMemberById, fetchTenantMembers } from '@/lib/api/employees';
import { canManageMember } from '@/lib/auth/manager-access';
import { formatDisplayName } from '@/lib/format-name';
import type { ApiTenantMember } from '@/lib/mappers/employee';
import { queryKeys } from '@/lib/query/keys';
import { useBreadcrumbTail } from '@/providers/breadcrumb-provider';
import { useTenant } from '@/providers/tenant-provider';
import { useEmployeeDetailForm } from '../hooks/use-employee-detail-form';
import { EmployeeDetailHeader } from './detail/employee-detail-header';
import { EmployeeDetailSidebar } from './detail/employee-detail-sidebar';
import { EmployeeDetailTabs } from './detail/tabs/employee-detail-tabs';

function resolveManagerName(member: ApiTenantMember, members: ApiTenantMember[]): string {
  if (!member.reportsToId) return '';
  const manager = members.find((m) => m.id === member.reportsToId);
  if (!manager) return '';
  const full = [manager.firstName, manager.middleName, manager.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return full || formatDisplayName(manager.preferredName, '');
}

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
      const [emergencyContacts, education, address, members] = await Promise.all([
        fetchEmergencyContacts(memberId),
        fetchEducationRecords(memberId),
        fetchMemberAddress(memberId),
        fetchTenantMembers(),
      ]);
      return {
        emergencyContacts,
        education,
        address,
        managerName: resolveManagerName(member, members),
      };
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
      key={`${member.id}:${member.isActive}`}
      member={member}
      memberId={memberId}
      emergencyContacts={records.emergencyContacts}
      education={records.education}
      address={records.address}
      managerName={records.managerName}
    />
  );
}

function EmployeeDetailFormReady({
  member,
  emergencyContacts,
  education,
  address,
  managerName,
  memberId,
}: {
  member: ApiTenantMember;
  emergencyContacts: Awaited<ReturnType<typeof fetchEmergencyContacts>>;
  education: Awaited<ReturnType<typeof fetchEducationRecords>>;
  address: Awaited<ReturnType<typeof fetchMemberAddress>>;
  managerName: string;
  memberId: string;
}) {
  const { tenant } = useTenant();
  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';
  const isSelf = tenant?.member?.id === memberId;
  const canEditPersonal = isSelf;
  const canEditOrg = isAdmin;
  const canEdit = canEditPersonal || canEditOrg;
  const memberTenantRole = member.role?.toLowerCase();
  const canManageStatus = isAdmin && !isSelf && memberTenantRole !== 'owner';
  const statusMutation = useUpdateEmployeeMemberStatus(memberId);

  const form = useEmployeeDetailForm(
    member,
    { emergencyContacts, education, address },
    { managerName, canEdit, canEditPersonal, isSelf, isAdmin },
  );

  return (
    <div className="space-y-6">
      <EmployeeDetailHeader
        isDirty={form.isDirty}
        isSaving={form.isSaving}
        canEdit={canEdit}
        onSave={form.handleSaveChanges}
      />

      <div className="flex flex-col md:flex-row gap-6">
        <EmployeeDetailSidebar
          employee={form.employee}
          memberId={memberId}
          isSelf={isSelf}
          canEdit={canEditPersonal}
          isAdmin={isAdmin}
          canManageStatus={canManageStatus}
          canManageRole={isAdmin && !isSelf && memberTenantRole !== 'owner'}
          statusUpdatePending={statusMutation.isPending}
          onMemberStatusChange={(isActive) => {
            statusMutation.mutate(isActive, {
              onSuccess: () => {
                toast.success(isActive ? 'Member reactivated' : 'Member deactivated');
              },
              onError: (err) => {
                toast.error(err instanceof Error ? err.message : 'Failed to update member status');
              },
            });
          }}
          onInputChange={form.handleInputChange}
          onAvatarUpdated={form.handleAvatarUpdated}
        />
        <EmployeeDetailTabs
          form={form}
          memberId={memberId}
          viewerMemberId={tenant?.member?.id}
          isAdmin={isAdmin}
          canEditPersonal={canEditPersonal}
        />
      </div>
    </div>
  );
}

const EmployeeDetail = () => {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <EmployeeDetailContent />
    </Suspense>
  );
};

function EmployeeDetailContent() {
  const { employeeID: id } = useParams<{ employeeID: string }>();
  const { tenantId, tenant, isLoading: tenantLoading } = useTenant();
  const role = tenant?.member?.role;
  const viewerMemberId = tenant?.member?.id;

  const { data: members = [] } = useQuery({
    queryKey: [...queryKeys.employees.all, tenantId, 'directory'],
    queryFn: fetchTenantMembers,
    enabled: Boolean(tenantId),
  });

  const targetMember = members.find((member) => member.id === id);
  const isSelf = viewerMemberId === id;
  const canViewDetail =
    isSelf ||
    (Boolean(viewerMemberId && targetMember) &&
      canManageMember(viewerMemberId!, targetMember!, role));

  const {
    data: member,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: [...queryKeys.employees.detail(id ?? ''), tenantId, 'member'],
    queryFn: () => fetchTenantMemberById(id!),
    enabled: Boolean(id) && Boolean(tenantId) && canViewDetail,
  });

  const displayName = member
    ? [member.firstName, member.middleName, member.lastName].filter(Boolean).join(' ').trim() ||
      formatDisplayName(member.preferredName, 'Employee')
    : null;

  useBreadcrumbTail(displayName ?? null);

  if (!tenantLoading && tenant && !canViewDetail) {
    return (
      <Alert>
        <AlertTitle>Profile not available</AlertTitle>
        <AlertDescription>
          You can browse the people directory, but full employee profiles are limited to your own
          profile, your direct reports, and admin users.
        </AlertDescription>
      </Alert>
    );
  }

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
}

export default EmployeeDetail;
