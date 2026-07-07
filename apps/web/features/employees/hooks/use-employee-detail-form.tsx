'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ToastMessage } from '@/components/toast-message';
import type { ApiAddress } from '@/lib/api/address';
import { upsertMemberAddress } from '@/lib/api/address';
import type { ApiEducation } from '@/lib/api/education';
import { createEducationRecord, deleteEducationRecord } from '@/lib/api/education';
import type { ApiEmergencyContact } from '@/lib/api/emergency-contacts';
import { createEmergencyContact, deleteEmergencyContact } from '@/lib/api/emergency-contacts';
import { updateEmployee } from '@/lib/api/employees';
import { updateMemberProfile } from '@/lib/api/member-profile';
import type { ApiTenantMember } from '@/lib/mappers/employee';
import {
  inferDegreeType,
  mapApiEducationRecord,
  mapApiEmergencyContact,
  normalizePhoneNumber,
  normalizeRelationship,
} from '@/lib/mappers/employee-records';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';
import type { EducationFormValues } from '../components/education-form';
import type { EmergencyContactFormValues } from '../components/emergency-contact-form';
import {
  createEmployeeDetailState,
  type EmployeeDetailState,
  memberFullName,
} from '../lib/employee-detail-state';

type EmployeeRecords = {
  emergencyContacts: ApiEmergencyContact[];
  education: ApiEducation[];
  address?: ApiAddress | null;
};

type EmployeeDetailFormOptions = {
  managerName?: string;
  canEdit?: boolean;
  isSelf?: boolean;
  isAdmin?: boolean;
};

export function useEmployeeDetailForm(
  baseMember: ApiTenantMember,
  initialRecords: EmployeeRecords,
  options?: EmployeeDetailFormOptions,
) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [emergencyContactDialogOpen, setEmergencyContactDialogOpen] = useState(false);
  const [educationDialogOpen, setEducationDialogOpen] = useState(false);
  const initialState = useMemo(
    () =>
      createEmployeeDetailState(
        baseMember,
        {
          emergencyContacts: initialRecords.emergencyContacts,
          education: initialRecords.education,
          address: initialRecords.address,
        },
        { managerName: options?.managerName },
      ),
    [
      baseMember,
      initialRecords.education,
      initialRecords.emergencyContacts,
      initialRecords.address,
      options?.managerName,
    ],
  );
  const [employee, setEmployee] = useState<EmployeeDetailState>(initialState);

  const handleInputChange = (field: string, value: string) => {
    setEmployee((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'firstName' || field === 'middleName' || field === 'lastName') {
        next.name = memberFullName(next);
      }
      return next;
    });
    setIsDirty(true);
  };

  const handleNestedInputChange = (
    parent: keyof EmployeeDetailState,
    field: string,
    value: string,
  ) => {
    setEmployee((prev) => {
      const updatedParent = {
        ...(prev[parent] as Record<string, unknown>),
      };
      updatedParent[field] = value;
      return { ...prev, [parent]: updatedParent };
    });
    setIsDirty(true);
  };

  const invalidateMemberQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.employees.detail(employee.id), tenantId, 'member'],
      }),
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.employees.all, tenantId, 'directory'],
      }),
      queryClient.invalidateQueries({ queryKey: [...queryKeys.employees.all, tenantId] }),
    ]);
  };

  const handleSaveChanges = async () => {
    if (options?.canEdit === false) return;

    setIsSaving(true);
    try {
      const profilePayload = {
        firstName: employee.firstName.trim(),
        lastName: employee.lastName.trim(),
        middleName: employee.middleName.trim() || undefined,
        preferredName: employee.preferredName || undefined,
        phone: employee.phone || undefined,
        dateOfBirth: employee.dateOfBirth || undefined,
        gender: employee.personalInfo.gender || undefined,
      };

      if (options?.isSelf) {
        await updateMemberProfile(profilePayload);
      } else {
        const adminPayload = {
          ...profilePayload,
          ...(options?.isAdmin
            ? {
                role: employee.workspaceRole,
                departmentId: employee.departmentId || null,
                reportsToId: employee.reportsToId || null,
              }
            : {}),
        };
        await updateEmployee(employee.id, adminPayload);
      }

      const { street, city, state, zipCode, country } = employee.address;
      const hasAddress =
        street.trim() || city.trim() || state.trim() || zipCode.trim() || country.trim();
      if (hasAddress) {
        if (!city.trim() || !state.trim() || !country.trim()) {
          toast.error('Address requires city, state, and country');
          return;
        }
        const saved = await upsertMemberAddress(employee.id, {
          street: street.trim() || undefined,
          city: city.trim(),
          state: state.trim(),
          postalCode: zipCode.trim() || undefined,
          country: country.trim(),
        });
        setEmployee((prev) => ({
          ...prev,
          addressId: saved.id,
          address: {
            street: saved.street ?? '',
            city: saved.city,
            state: saved.state,
            zipCode: saved.postalCode ?? '',
            country: saved.country,
          },
        }));
      }

      await invalidateMemberQueries();

      toast.success(
        <ToastMessage
          title="Changes saved"
          description="Employee information has been updated successfully."
        />,
      );
      setIsDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save employee');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddEmergencyContact = async (contact: EmergencyContactFormValues) => {
    try {
      const created = await createEmergencyContact({
        memberId: employee.id,
        fullName: contact.name,
        phoneNumber: normalizePhoneNumber(contact.phone),
        email: contact.email || undefined,
        relationship: normalizeRelationship(contact.relationship),
        address: contact.address || undefined,
        isPrimary: contact.isEmergencyContact,
      });

      setEmployee((prev) => ({
        ...prev,
        emergencyContacts: [...prev.emergencyContacts, mapApiEmergencyContact(created)],
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add emergency contact');
      throw err;
    }
  };

  const handleDeleteEmergencyContact = async (contactId: string) => {
    try {
      await deleteEmergencyContact(contactId);
      setEmployee((prev) => ({
        ...prev,
        emergencyContacts: prev.emergencyContacts.filter((contact) => contact.id !== contactId),
      }));
      toast.success('Emergency contact removed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove emergency contact');
    }
  };

  const handleAddEducation = async (education: EducationFormValues) => {
    try {
      const created = await createEducationRecord({
        memberId: employee.id,
        title: education.degree,
        degreeType: inferDegreeType(education.degree),
        institution: education.institution,
        fieldOfStudy: education.field || undefined,
        endDate: education.year ? `${education.year}-06-01` : undefined,
        description: education.description || undefined,
        gpa: education.grade || undefined,
      });

      setEmployee((prev) => ({
        ...prev,
        education: [...prev.education, mapApiEducationRecord(created)],
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add education record');
      throw err;
    }
  };

  const handleDeleteEducation = async (educationId: string) => {
    try {
      await deleteEducationRecord(educationId);
      setEmployee((prev) => ({
        ...prev,
        education: prev.education.filter((record) => record.id !== educationId),
      }));
      toast.success('Education record removed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove education record');
    }
  };

  return {
    employee,
    canEdit: options?.canEdit !== false,
    isDirty,
    isSaving,
    emergencyContactDialogOpen,
    setEmergencyContactDialogOpen,
    educationDialogOpen,
    setEducationDialogOpen,
    handleInputChange,
    handleNestedInputChange,
    handleSaveChanges,
    handleAvatarUpdated: (avatarUrl: string) => {
      setEmployee((prev) => ({ ...prev, profileImage: avatarUrl }));
    },
    handleAddEmergencyContact,
    handleDeleteEmergencyContact,
    handleAddEducation,
    handleDeleteEducation,
  };
}

export type EmployeeDetailForm = ReturnType<typeof useEmployeeDetailForm>;
