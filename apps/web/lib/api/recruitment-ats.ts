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
}): Promise<PipelineStage> {
  return apiClient<PipelineStage>(await atsPath('pipeline/stages'), {
    method: 'POST',
    body: input,
  });
}

export async function updatePipelineStage(
  id: string,
  input: { name?: string; type?: string; autoEmailTemplateId?: string | null },
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
