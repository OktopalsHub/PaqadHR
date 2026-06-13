import { z } from "zod";

export const jobStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "INACTIVE",
  "CLOSED",
  "ARCHIVED",
]);

const jobLocationSchema = z.object({
  type: z.enum(["ONSITE", "REMOTE", "HYBRID"]),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

export const jobOpeningSchema = z.object({
  id: z.string(),
  title: z.string(),
  departmentId: z.string().optional(),
  departmentName: z.string().optional(),
  position: z.string().optional(),
  employmentType: z.string().optional(),
  experienceLevel: z.string().optional(),
  status: jobStatusSchema,
  isUrgent: z.boolean().optional(),
  publishedAt: z.string().nullable().optional(),
  applicationDeadline: z.string().nullable().optional(),
  numberOfOpenings: z.number().nullable().optional(),
  description: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  responsibilities: z.array(z.string()).optional(),
  location: jobLocationSchema.optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const createJobOpeningInputSchema = z.object({
  title: z.string().min(2),
  departmentId: z.string().uuid(),
  position: z.string().min(1),
  employmentType: z.enum([
    "FULL_TIME",
    "PART_TIME",
    "CONTRACT",
    "INTERNSHIP",
    "TEMPORARY",
  ]),
  experienceLevel: z.string().min(1),
  location: jobLocationSchema,
  description: z.string().min(10),
  requirements: z.array(z.string()).min(1),
  responsibilities: z.array(z.string()),
  numberOfOpenings: z.number().min(1).optional(),
  applicationDeadline: z.string().optional(),
  isUrgent: z.boolean().optional(),
  publish: z.boolean().optional(),
});

export type CreateJobOpeningInput = z.infer<typeof createJobOpeningInputSchema>;

export type JobOpening = z.infer<typeof jobOpeningSchema>;
export type JobStatus = z.infer<typeof jobStatusSchema>;

export const candidateStatusSchema = z.enum([
  "APPLIED",
  "SCREENING",
  "UNDER_REVIEW",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
]);

export const candidateSourceSchema = z.enum([
  "INTERNAL",
  "PUBLIC_WEBSITE",
  "LINKEDIN",
  "INDEED",
  "OTHER",
]);

export const candidateSchema = z.object({
  id: z.string(),
  jobOpeningId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  status: candidateStatusSchema,
  source: candidateSourceSchema.optional(),
  skills: z.string().optional(),
  resume: z
    .object({
      filename: z.string().optional(),
      url: z.string().optional(),
    })
    .optional(),
  appliedAt: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Candidate = z.infer<typeof candidateSchema>;
export type CandidateStatus = z.infer<typeof candidateStatusSchema>;
export type CandidateSource = z.infer<typeof candidateSourceSchema>;

export const candidatesListResponseSchema = z.array(candidateSchema);

export const jobsListResponseSchema = z.object({
  jobs: z.array(jobOpeningSchema),
  total: z.number(),
});
