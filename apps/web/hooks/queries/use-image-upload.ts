'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateEmployee } from '@/lib/api/employees';
import { uploadMemberAvatar, uploadWorkspaceLogo } from '@/lib/api/files';
import { updateMemberProfile } from '@/lib/api/member-profile';
import { updateTenant } from '@/lib/api/tenants';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

export function useMemberAvatarUpload(options?: { memberId?: string; isSelf?: boolean }) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async (file: File) => {
      const { fileName } = await uploadMemberAvatar(file);
      if (options?.isSelf) {
        const profile = await updateMemberProfile({ avatarKey: fileName });
        return profile.avatarUrl ?? undefined;
      }
      if (!options?.memberId) {
        throw new Error('Member ID is required');
      }
      const member = await updateEmployee(options.memberId, { avatarKey: fileName });
      return member.avatar || undefined;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.member.profile(tenantId ?? '') });
      void queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
      if (options?.memberId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.employees.detail(options.memberId),
        });
      }
      toast.success('Photo updated');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to upload photo');
    },
  });
}

export function useWorkspaceLogoUpload() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!tenantId) throw new Error('No workspace selected');
      const { fileName } = await uploadWorkspaceLogo(file);
      await updateTenant(tenantId, { logoKey: fileName });
      return undefined;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all });
      toast.success('Workspace logo updated');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to upload logo');
    },
  });
}
