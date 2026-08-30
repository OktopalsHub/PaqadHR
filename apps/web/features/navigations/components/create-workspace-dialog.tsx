'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WorkspaceSlugField } from '@/features/navigations/components/workspace-slug-field';
import { useCreateTenant } from '@/hooks/queries/use-tenants';
import { subscribePagePath } from '@/lib/navigation/tenant-routes';
import { queryKeys } from '@/lib/query/keys';
import { persistTenantId, persistTenantSlug } from '@/lib/session';
import { isSlugFormatValid } from '@/lib/utils/slug';

type CreateWorkspaceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateWorkspaceDialog({ open, onOpenChange }: CreateWorkspaceDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const createTenant = useCreateTenant();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      toast.error('Workspace name must be at least 3 characters');
      return;
    }
    if (slug.trim() && !isSlugFormatValid(slug.trim())) {
      toast.error('Slug format is invalid');
      return;
    }

    try {
      const tenant = await createTenant.mutateAsync({
        name: trimmed,
        slug: slug.trim() || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all });
      setName('');
      setSlug('');
      onOpenChange(false);
      toast.success('Workspace created');
      persistTenantId(tenant.id);
      if (tenant.slug) {
        persistTenantSlug(tenant.slug);
        router.push(subscribePagePath({ welcome: true, workspace: tenant.slug }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create workspace');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Company name</Label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc."
              autoFocus
            />
          </div>
          <WorkspaceSlugField key={String(open)} name={name} slug={slug} onSlugChange={setSlug} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={createTenant.isPending} onClick={handleCreate}>
            {createTenant.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
