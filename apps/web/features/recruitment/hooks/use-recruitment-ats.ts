'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addPipelineStage,
  createEmailTemplate,
  deleteEmailTemplate,
  deletePipelineStage,
  draftEmailWithAi,
  fetchEmailTemplates,
  fetchPipeline,
  fetchTemplateVariables,
  reorderPipeline,
  updateEmailTemplate,
  updatePipelineStage,
} from '@/lib/api/recruitment-ats';
import { useTenant } from '@/providers/tenant-provider';

export const atsKeys = {
  templates: (tenantId: string | null | undefined) =>
    ['recruitment', tenantId, 'email-templates'] as const,
  variables: (tenantId: string | null | undefined) =>
    ['recruitment', tenantId, 'template-variables'] as const,
  pipeline: (tenantId: string | null | undefined) =>
    ['recruitment', tenantId, 'pipeline'] as const,
};

export function useEmailTemplates() {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: atsKeys.templates(tenantId),
    queryFn: fetchEmailTemplates,
    enabled: Boolean(tenantId),
  });
}

export function useTemplateVariables() {
  const { tenantId } = useTenant();
  return useQuery({
    enabled: Boolean(tenantId),
    queryKey: atsKeys.variables(tenantId),
    queryFn: fetchTemplateVariables,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useSaveEmailTemplate() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: (input: {
      id?: string;
      name: string;
      subject: string;
      bodyHtml: string;
      isActive?: boolean;
    }) => {
      const { id, ...body } = input;
      return id ? updateEmailTemplate(id, body) : createEmailTemplate(body);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: atsKeys.templates(tenantId) }),
  });
}

export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: deleteEmailTemplate,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: atsKeys.templates(tenantId) });
      void queryClient.invalidateQueries({ queryKey: atsKeys.pipeline(tenantId) });
    },
  });
}

export function useDraftEmailWithAi() {
  return useMutation({ mutationFn: draftEmailWithAi });
}

export function usePipeline() {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: atsKeys.pipeline(tenantId),
    queryFn: () => fetchPipeline(),
    enabled: Boolean(tenantId),
  });
}

export function usePipelineMutations() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const refresh = () => queryClient.invalidateQueries({ queryKey: atsKeys.pipeline(tenantId) });
  return {
    add: useMutation({ mutationFn: addPipelineStage, onSuccess: refresh }),
    update: useMutation({
      mutationFn: (input: {
        id: string;
        name?: string;
        type?: string;
        autoEmailTemplateId?: string | null;
        color?: string | null;
      }) => {
        const { id, ...body } = input;
        return updatePipelineStage(id, body);
      },
      onSuccess: refresh,
    }),
    reorder: useMutation({ mutationFn: reorderPipeline, onSuccess: refresh }),
    remove: useMutation({ mutationFn: deletePipelineStage, onSuccess: refresh }),
  };
}
