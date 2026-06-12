"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ToastMessage } from "@/components/toast-message";
import type { EmergencyContactFormValues } from "../components/emergency-contact-form";
import type { EducationFormValues } from "../components/education-form";
import {
  createEmployeeDetailState,
  type EmployeeDetailState,
} from "../lib/employee-detail-state";
import type { Employee } from "@/lib/schemas/employee";

export function useEmployeeDetailForm(baseEmployee: Employee) {
  const [isDirty, setIsDirty] = useState(false);
  const [emergencyContactDialogOpen, setEmergencyContactDialogOpen] =
    useState(false);
  const [educationDialogOpen, setEducationDialogOpen] = useState(false);
  const [employee, setEmployee] = useState<EmployeeDetailState>(() =>
    createEmployeeDetailState(baseEmployee),
  );

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

  const handleSaveChanges = () => {
    toast.success(
      <ToastMessage
        title="Changes saved"
        description="Employee information has been updated successfully."
      />,
    );
    setIsDirty(false);
  };

  const handleAddEmergencyContact = (contact: EmergencyContactFormValues) => {
    setEmployee((prev) => ({
      ...prev,
      emergencyContacts: [
        ...prev.emergencyContacts,
        {
          name: contact.name,
          relationship: contact.relationship,
          phone: contact.phone,
          email: contact.email ?? "",
          address: contact.address ?? "",
          isEmergencyContact: contact.isEmergencyContact,
        },
      ],
    }));
    setIsDirty(true);
  };

  const handleAddEducation = (education: EducationFormValues) => {
    setEmployee((prev) => ({
      ...prev,
      education: [
        ...prev.education,
        {
          degree: education.degree,
          institution: education.institution,
          year: education.year,
        },
      ],
    }));
    setIsDirty(true);
  };

  return {
    employee,
    isDirty,
    emergencyContactDialogOpen,
    setEmergencyContactDialogOpen,
    educationDialogOpen,
    setEducationDialogOpen,
    handleInputChange,
    handleNestedInputChange,
    handleSaveChanges,
    handleAddEmergencyContact,
    handleAddEducation,
  };
}

export type EmployeeDetailForm = ReturnType<typeof useEmployeeDetailForm>;
