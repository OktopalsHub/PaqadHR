import type { ApiEducation } from "@/lib/api/education";
import type { ApiEmergencyContact } from "@/lib/api/emergency-contacts";

export function mapApiEmergencyContact(contact: ApiEmergencyContact) {
  return {
    id: contact.id,
    name: contact.fullName,
    relationship: contact.relationship,
    phone: contact.phoneNumber,
    email: contact.email ?? "",
    address: contact.address ?? "",
    isEmergencyContact: contact.isPrimary,
  };
}

export function mapApiEducationRecord(record: ApiEducation) {
  const year = record.endDate
    ? new Date(record.endDate).getFullYear().toString()
    : "";

  return {
    id: record.id,
    degree: record.title,
    institution: record.institution,
    year,
    field: record.fieldOfStudy ?? "",
    grade: record.gpa ?? "",
    description: record.description ?? "",
  };
}

const RELATIONSHIP_VALUES = new Set([
  "spouse",
  "parent",
  "child",
  "sibling",
  "friend",
  "other",
]);

export function normalizeRelationship(value: string): string {
  const normalized = value.trim().toLowerCase();
  return RELATIONSHIP_VALUES.has(normalized) ? normalized : "other";
}

export function normalizePhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return value;
  if (value.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

export function inferDegreeType(degree: string): string {
  const normalized = degree.toLowerCase();
  if (normalized.includes("doctor") || normalized.includes("phd")) {
    return "doctorate";
  }
  if (normalized.includes("master") || normalized.includes("mba")) {
    return "master";
  }
  if (normalized.includes("bachelor") || normalized.includes("b.s") || normalized.includes("b.a")) {
    return "bachelor";
  }
  if (normalized.includes("associate")) return "associate";
  if (normalized.includes("certificate")) return "certificate";
  if (normalized.includes("diploma")) return "diploma";
  if (normalized.includes("high school")) return "high_school";
  return "other";
}
