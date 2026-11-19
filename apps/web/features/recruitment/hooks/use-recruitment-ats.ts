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

export const atsKeys = {
  templates: ['recruitment', 'email-templates'] as const,
  variables: ['recruitment', 'template-variables'] as const,
  pipeline: ['recruitment', 'pipeline'] as const,
};

export function useEmailTemplates() {
  return useQuery({ queryKey: atsKeys.templates, queryFn: fetchEmailTemplates });
}

export function useTemplateVariables() {
  return useQuery({
    queryKey: atsKeys.variables,
    queryFn: fetchTemplateVariables,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useSaveEmailTemplate() {
  const queryClient = useQueryClient();
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: atsKeys.templates }),
  });
}

export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteEmailTemplate,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: atsKeys.templates });
      void queryClient.invalidateQueries({ queryKey: atsKeys.pipeline });
    },
  });
}

export function useDraftEmailWithAi() {
  return useMutation({ mutationFn: draftEmailWithAi });
}

export function usePipeline() {
  return useQuery({ queryKey: atsKeys.pipeline, queryFn: () => fetchPipeline() });
}

export function usePipelineMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: atsKeys.pipeline });
  return {
    add: useMutation({ mutationFn: addPipelineStage, onSuccess: refresh }),
    update: useMutation({
      mutationFn: (input: {
        id: string;
        name?: string;
        type?: string;
        autoEmailTemplateId?: string | null;
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
