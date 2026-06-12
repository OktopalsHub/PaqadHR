import type { Employee } from "@/lib/schemas/employee";

export type EmployeeDetailState = ReturnType<typeof createEmployeeDetailState>;

export function createEmployeeDetailState(base: Employee) {
  return {
    id: base.id,
    name: base.name,
    preferredName: "",
    position: base.role,
    department: base.department,
    email: base.email,
    phone: "+1 (555) 123-4567",
    dateOfBirth: "1985-03-15",
    hireDate: base.joinDate,
    status: base.status,
    manager: "John Doe",
    profileImage: base.avatar,
    address: {
      street: "123 Main Street",
      city: "San Francisco",
      state: "CA",
      zipCode: "94105",
      country: "United States",
    },
    emergencyContacts: [
      {
        name: "Michael Smith",
        relationship: "Spouse",
        phone: "+1 (555) 987-6543",
        email: "michael.smith@example.com",
        address: "123 Main Street, San Francisco, CA 94105",
        isEmergencyContact: true,
      },
    ],
    personalInfo: {
      gender: "Female",
      maritalStatus: "Married",
      nationality: "American",
      bloodGroup: "O+",
    },
    employment: {
      employeeId: `EMP-${base.id}`,
      employeeType: "Full-Time",
      division: "Product",
      team: "User Experience",
      workLocation: "San Francisco HQ",
      joinDate: base.joinDate,
      reportingTo: "John Doe",
      payGrade: "L4",
      workSchedule: "Monday - Friday, 9 AM - 5 PM",
    },
    compensation: {
      salary: "$120,000",
      payFrequency: "Monthly",
      bonusPlan: "Performance-Based Annual",
      lastIncrement: {
        date: "2023-01-15",
        percentage: "8%",
        amount: "$9,600",
      },
      benefits: [
        "Health Insurance",
        "Dental Insurance",
        "401k with 5% match",
        "Stock Options",
      ],
    },
    documents: [
      {
        id: 1,
        name: "Employment Contract",
        type: "PDF",
        dateUploaded: base.joinDate,
        status: "Signed",
      },
      {
        id: 2,
        name: "Performance Review 2023",
        type: "PDF",
        dateUploaded: "2023-06-15",
        status: "Approved",
      },
    ],
    timeOff: {
      availableBalance: {
        vacation: 15,
        sick: 8,
        personal: 3,
      },
      recentRequests: [
        {
          id: 1,
          type: "Vacation",
          dates: "July 10-15, 2023",
          status: "Approved",
          days: 5,
        },
      ],
    },
    skills: ["UX Design", "Figma", "User Research", "Prototyping", "UI Design"],
    education: [
      {
        degree: "Master of Fine Arts in Design",
        institution: "Rhode Island School of Design",
        year: "2013",
      },
    ],
  };
}
