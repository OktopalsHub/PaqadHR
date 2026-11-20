import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  isActive: boolean;
};

export type EmailTemplateInput = {
  name: string;
  subject: string;
  bodyHtml: string;
  isActive?: boolean;
};

export type PipelineStage = {
  id: string;
  name: string;
  type: string;
  position: number;
  autoEmailTemplateId: string | null;
  color: string | null;
  jobOpeningId: string | null;
};

export type EmailDraft = { subject: string; bodyHtml: string };
export type EmailTone = 'friendly' | 'formal' | 'warm' | 'concise';

async function atsPath(path: string): Promise<string> {
  const tenantId = await resolveTenantId();
  return tenantPath(tenantId, `recruitment/${path}`);
}

export async function fetchEmailTemplates(): Promise<EmailTemplate[]> {
  return apiClient<EmailTemplate[]>(await atsPath('email-templates'));
}

export async function fetchTemplateVariables(): Promise<string[]> {
  const data = await apiClient<{ variables: string[] }>(await atsPath('email-templates/variables'));
  return data.variables;
}

export async function createEmailTemplate(input: EmailTemplateInput): Promise<EmailTemplate> {
  return apiClient<EmailTemplate>(await atsPath('email-templates'), {
    method: 'POST',
    body: input,
  });
}

export async function updateEmailTemplate(
  id: string,
  input: Partial<EmailTemplateInput>,
): Promise<EmailTemplate> {
  return apiClient<EmailTemplate>(await atsPath(`email-templates/${id}`), {
    method: 'PATCH',
    body: input,
  });
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  await apiClient(await atsPath(`email-templates/${id}`), { method: 'DELETE' });
}

export async function previewEmailTemplate(input: {
  subject: string;
  bodyHtml: string;
}): Promise<{ subject: string; html: string }> {
  return apiClient<{ subject: string; html: string }>(await atsPath('email-templates/preview'), {
    method: 'POST',
    body: input,
  });
}

export async function draftEmailWithAi(input: {
  purpose: string;
  tone: EmailTone;
}): Promise<EmailDraft> {
  return apiClient<EmailDraft>(await atsPath('ai/email-draft'), { method: 'POST', body: input });
}

export async function fetchPipeline(jobOpeningId?: string): Promise<PipelineStage[]> {
  const suffix = jobOpeningId ? `?jobOpeningId=${encodeURIComponent(jobOpeningId)}` : '';
  return apiClient<PipelineStage[]>(`${await atsPath('pipeline')}${suffix}`);
}

export async function addPipelineStage(input: {
  name: string;
  type: string;
  autoEmailTemplateId?: string | null;
  color?: string | null;
}): Promise<PipelineStage> {
  return apiClient<PipelineStage>(await atsPath('pipeline/stages'), {
    method: 'POST',
    body: input,
  });
}

export async function updatePipelineStage(
  id: string,
  input: {
    name?: string;
    type?: string;
    autoEmailTemplateId?: string | null;
    color?: string | null;
  },
): Promise<PipelineStage> {
  return apiClient<PipelineStage>(await atsPath(`pipeline/stages/${id}`), {
    method: 'PATCH',
    body: input,
  });
}

export async function reorderPipeline(stageIds: string[]): Promise<PipelineStage[]> {
  return apiClient<PipelineStage[]>(await atsPath('pipeline/order'), {
    method: 'PUT',
    body: { stageIds },
  });
}

export async function deletePipelineStage(id: string): Promise<void> {
  await apiClient(await atsPath(`pipeline/stages/${id}`), { method: 'DELETE' });
}

export type TimelineStage = {
  id: string;
  fromStageId: string | null;
  toStageId: string;
  reason: string | null;
  createdAt: string;
};

export type TimelineEmail = {
  id: string;
  subject: string;
  status: 'sent' | 'failed';
  trigger: 'manual' | 'stage';
  createdAt: string;
};

export type CandidateTimeline = { stages: TimelineStage[]; emails: TimelineEmail[] };

export type ScreeningResult = {
  score: number;
  recommendation: 'advance' | 'review' | 'reject';
  summary: string;
  strengths: string[];
  gaps: string[];
};

export type Recommendation = 'STRONG_YES' | 'YES' | 'NO' | 'STRONG_NO';

export type ScorecardsResponse = {
  attributes: string[];
  scorecards: Array<{
    id: string;
    reviewerMemberId: string;
    ratings: Record<string, number>;
    recommendation: Recommendation;
    notes: string | null;
  }>;
  summary: { count: number; averageRating: number | null; averageRecommendation: number | null };
};

export type Offer = {
  id: string;
  amount: string;
  currency: string;
  startDate: string | null;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED';
  sentAt: string | null;
};

export type TalentPoolCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  skills: string | null;
  status: string;
};

export type MoveStageEmail = { sendEmail?: boolean; emailTemplateId?: string };

export async function moveCandidateToStage(
  candidateId: string,
  stageId: string,
  email: MoveStageEmail = {},
): Promise<void> {
  await apiClient(await atsPath(`candidates/${candidateId}/stage`), {
    method: 'POST',
    body: { stageId, ...email },
  });
}

export async function fetchCandidateTimeline(candidateId: string): Promise<CandidateTimeline> {
  return apiClient<CandidateTimeline>(await atsPath(`candidates/${candidateId}/timeline`));
}

export async function sendCandidateEmail(candidateId: string, templateId: string) {
  return apiClient<{ id: string; status: 'sent' | 'failed'; subject: string }>(
    await atsPath(`candidates/${candidateId}/emails`),
    { method: 'POST', body: { templateId } },
  );
}

export async function screenCandidateWithAi(candidateId: string): Promise<ScreeningResult> {
  return apiClient<ScreeningResult>(await atsPath(`candidates/${candidateId}/ai-screening`), {
    method: 'POST',
  });
}

export async function fetchScorecards(candidateId: string): Promise<ScorecardsResponse> {
  return apiClient<ScorecardsResponse>(await atsPath(`candidates/${candidateId}/scorecards`));
}

export async function submitScorecard(
  candidateId: string,
  input: { ratings: Record<string, number>; recommendation: Recommendation; notes?: string },
): Promise<ScorecardsResponse> {
  return apiClient<ScorecardsResponse>(await atsPath(`candidates/${candidateId}/scorecards`), {
    method: 'POST',
    body: input,
  });
}

export async function fetchOffers(candidateId: string): Promise<Offer[]> {
  return apiClient<Offer[]>(await atsPath(`candidates/${candidateId}/offers`));
}

export async function createOffer(
  candidateId: string,
  input: { amount: number; currency: string; startDate?: string },
): Promise<Offer> {
  return apiClient<Offer>(await atsPath(`candidates/${candidateId}/offers`), {
    method: 'POST',
    body: input,
  });
}

export async function sendOffer(offerId: string, templateId?: string): Promise<Offer> {
  return apiClient<Offer>(await atsPath(`offers/${offerId}/send`), {
    method: 'POST',
    body: templateId ? { templateId } : {},
  });
}

export async function respondToOffer(
  offerId: string,
  outcome: 'ACCEPTED' | 'DECLINED',
): Promise<Offer> {
  return apiClient<Offer>(await atsPath(`offers/${offerId}/respond`), {
    method: 'POST',
    body: { outcome },
  });
}

export async function fetchTalentPool(): Promise<TalentPoolCandidate[]> {
  return apiClient<TalentPoolCandidate[]>(await atsPath('talent-pool'));
}

export async function setTalentPool(candidateId: string, inPool: boolean): Promise<void> {
  await apiClient(await atsPath(`candidates/${candidateId}/talent-pool`), {
    method: 'POST',
    body: { inPool },
  });
}

export type RecruitmentPreferences = { askEmailOnMove: boolean };

export async function fetchRecruitmentPreferences(): Promise<RecruitmentPreferences> {
  return apiClient<RecruitmentPreferences>(await atsPath('preferences/me'));
}

export async function updateRecruitmentPreferences(
  input: RecruitmentPreferences,
): Promise<RecruitmentPreferences> {
  return apiClient<RecruitmentPreferences>(await atsPath('preferences/me'), {
    method: 'PATCH',
    body: input,
  });
}
