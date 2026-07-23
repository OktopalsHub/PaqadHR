'use client';

import { Heart, Plus, UserPlus, Wallet } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { isTenantAdmin } from '@/lib/auth/manager-access';
import { useTenant } from '@/providers/tenant-provider';

export function QuickActionsMenu() {
  const tenantHref = useTenantHref();
  const { tenant } = useTenant();
  const isAdmin = isTenantAdmin(tenant?.member?.role);

  const actions = isAdmin
    ? ([
        { label: 'Add employee', segment: 'employees', icon: UserPlus },
        { label: 'Run payroll', segment: 'payroll', icon: Wallet },
        { label: 'Send shoutout', segment: 'shoutouts', icon: Heart },
      ] as const)
    : ([{ label: 'Send shoutout', segment: 'shoutouts', icon: Heart }] as const);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-9 rounded-full border-border/70 bg-background/90"
        >
          <Plus className="size-4 drop-shadow-[0_1px_2px_rgba(11,28,48,0.18)]" />
          <span className="sr-only">Quick actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl">
        {actions.map((action) => (
          <DropdownMenuItem key={action.label} asChild>
            <Link href={tenantHref(action.segment)} className="gap-2">
              <action.icon className="size-4 text-primary" />
              {action.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
