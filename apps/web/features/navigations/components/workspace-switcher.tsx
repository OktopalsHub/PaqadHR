'use client';

import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useState } from 'react';
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
    return (
      // biome-ignore lint/performance/noImgElement: external workspace logo URL
      <img
        src={logoUrl}
        alt=""
        className="size-9 shrink-0 rounded-[10px] border border-[#d7e3f6] bg-white object-cover shadow-sm dark:border-slate-700 dark:bg-slate-950"
      />
    );
  }
  const letter = (name?.trim()?.[0] ?? 'P').toUpperCase();
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary text-sm font-bold text-primary-foreground shadow-[0_10px_18px_-14px_rgba(234,179,8,0.72)]">
      {letter}
    </span>
  );
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
        <div className="flex items-center gap-2.5 px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
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
            className="h-auto w-full justify-start gap-2.5 rounded-[10px] px-1.5 py-1.5 font-normal hover:bg-sidebar-accent group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
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
