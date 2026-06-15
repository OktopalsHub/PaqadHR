'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ToastMessage } from '@/components/toast-message';
import type { ApiEducation } from '@/lib/api/education';
import { createEducationRecord, deleteEducationRecord } from '@/lib/api/education';
import type { ApiEmergencyContact } from '@/lib/api/emergency-contacts';
import { createEmergencyContact, deleteEmergencyContact } from '@/lib/api/emergency-contacts';
import { updateEmployee } from '@/lib/api/employees';
import type { ApiTenantMember } from '@/lib/mappers/employee';
import {
  inferDegreeType,
  mapApiEducationRecord,
  mapApiEmergencyContact,
  normalizePhoneNumber,
  normalizeRelationship,
} from '@/lib/mappers/employee-records';
import type { EducationFormValues } from '../components/education-form';
import type { EmergencyContactFormValues } from '../components/emergency-contact-form';
import { createEmployeeDetailState, type EmployeeDetailState } from '../lib/employee-detail-state';

type EmployeeRecords = {
  emergencyContacts: ApiEmergencyContact[];
  education: ApiEducation[];
};

export function useEmployeeDetailForm(
  baseMember: ApiTenantMember,
  initialRecords: EmployeeRecords,
) {
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [emergencyContactDialogOpen, setEmergencyContactDialogOpen] = useState(false);
  const [educationDialogOpen, setEducationDialogOpen] = useState(false);
  const initialState = useMemo(
    () =>
      createEmployeeDetailState(baseMember, {
        emergencyContacts: initialRecords.emergencyContacts,
        education: initialRecords.education,
      }),
    [baseMember, initialRecords.education, initialRecords.emergencyContacts],
  );
  const [employee, setEmployee] = useState<EmployeeDetailState>(initialState);

  const handleInputChange = (field: string, value: string) => {
    setEmployee((prev) => ({ ...prev, [field]: value }));
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

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const nameParts = employee.name.trim().split(/\s+/);
      const firstName = nameParts[0] ?? employee.firstName;
      const lastName = nameParts.slice(1).join(' ') || employee.lastName;

      await updateEmployee(employee.id, {
        firstName,
        lastName,
        preferredName: employee.preferredName || undefined,
        phone: employee.phone || undefined,
        dateOfBirth: employee.dateOfBirth || undefined,
        gender: employee.personalInfo.gender || undefined,
      });

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
    isDirty,
    isSaving,
    emergencyContactDialogOpen,
    setEmergencyContactDialogOpen,
    educationDialogOpen,
    setEducationDialogOpen,
    handleInputChange,
    handleNestedInputChange,
    handleSaveChanges,
    handleAddEmergencyContact,
    handleDeleteEmergencyContact,
    handleAddEducation,
    handleDeleteEducation,
  };
}

export type EmployeeDetailForm = ReturnType<typeof useEmployeeDetailForm>;
