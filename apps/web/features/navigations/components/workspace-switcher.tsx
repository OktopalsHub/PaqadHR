'use client';

import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useState } from 'react';
import { OrgAvatar } from '@/components/org-avatar';
import { PaqadLogo } from '@/components/paqad-logo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateWorkspaceDialog } from '@/features/navigations/components/create-workspace-dialog';
import { formatWorkspaceName } from '@/lib/format-name';
import { cn } from '@/lib/utils';
import { useTenant } from '@/providers/tenant-provider';

function WorkspaceMark({ name, logoUrl }: { name?: string; logoUrl?: string | null }) {
  if (logoUrl) {
    return <OrgAvatar src={logoUrl} name={name || 'Workspace'} />;
  }

  if (!name?.trim()) {
    return <PaqadLogo showWordmark={false} className="size-8" />;
  }

  return <OrgAvatar name={name} />;
}

export const WorkspaceSwitcher = () => {
  const { tenant, tenants, setTenantId, isLoading } = useTenant();
  const [createOpen, setCreateOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2.5 px-1">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-8 flex-1 rounded-lg" />
      </div>
    );
  }

  if (!tenants.length) {
    return (
      <>
        <div className="flex items-center gap-2.5 px-1">
          <WorkspaceMark />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold tracking-tight">Paqad</p>
            <button
              type="button"
              className="truncate text-xs text-primary hover:underline"
              onClick={() => setCreateOpen(true)}
            >
              Create workspace
            </button>
          </div>
        </div>
        <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-auto w-full justify-start gap-2.5 px-1 py-1.5 font-normal hover:bg-sidebar-accent"
          >
            <WorkspaceMark
              name={tenant?.name}
              logoUrl={(tenant as { logoUrl?: string })?.logoUrl}
            />
            <div className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold tracking-tight">
                {formatWorkspaceName(tenant?.name)}
              </p>
            </div>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50 group-data-[collapsible=icon]:hidden" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 rounded-xl">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Workspaces
          </DropdownMenuLabel>
          {tenants.map((item) => (
            <DropdownMenuItem key={item.id} onClick={() => setTenantId(item.id)} className="gap-2">
              <Check
                className={cn(
                  'size-4 shrink-0',
                  item.id === tenant?.id ? 'opacity-100' : 'opacity-0',
                )}
              />
              <span className="truncate">{formatWorkspaceName(item.name)}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="size-4" />
            Create workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
};
