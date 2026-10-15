'use client';

import { Building2, CreditCard, LogOut, User } from 'lucide-react';
import Link from 'next/link';
import { PersonAvatar } from '@/components/person-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { settingsTabHref } from '@/features/settings/lib/settings-tabs';
import { memberFullName, useMemberProfile } from '@/hooks/queries/use-member-profile';
import { useAuth } from '@/hooks/use-auth';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { useTenant } from '@/providers/tenant-provider';
import { ThemeMenuRow } from './theme-switcher';

export const AccountSetting = ({ logout }: { logout: () => void }) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { data: profile } = useMemberProfile();
  const tenantHref = useTenantHref();
  const settingsBase = tenantHref('settings');

  const name = memberFullName(profile);
  const position = profile?.position?.title?.trim();
  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-3 rounded-[12px] border border-[#d7e3f6] bg-white px-3 py-2 shadow-[0_12px_24px_-20px_rgba(11,28,48,0.28)] outline-none transition-[box-shadow,border-color,background-color] hover:border-[#c7d7f1] hover:bg-white hover:shadow-[0_16px_28px_-20px_rgba(11,28,48,0.34)] dark:border-slate-700 dark:bg-slate-950/80 dark:hover:border-slate-600 dark:hover:bg-slate-950"
        >
          <PersonAvatar
            src={profile?.avatarUrl}
            name={name}
            className="size-10 border border-[#d7e3f6] shadow-sm dark:border-slate-700"
            fallbackClassName="bg-primary/10 text-sm font-semibold text-primary dark:bg-primary/15 dark:text-primary"
          />
          <div className="hidden min-w-0 max-w-[140px] text-left lg:block">
            <p className="truncate text-sm font-semibold leading-tight text-slate-950 dark:text-slate-50">
              {name}
            </p>
            {position ? (
              <p className="truncate text-xs leading-tight text-slate-500 dark:text-slate-400">
                {position}
              </p>
            ) : null}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-64 rounded-xl p-1" align="end" sideOffset={4}>
        <DropdownMenuLabel className="px-2 py-2 font-normal">
          <div className="flex items-center gap-3">
            <PersonAvatar src={profile?.avatarUrl} name={name} className="size-10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href={settingsTabHref(settingsBase, 'profile')} className="gap-2">
              <User className="size-4" />
              Profile
            </Link>
          </DropdownMenuItem>
          {isAdmin ? (
            <>
              <DropdownMenuItem asChild>
                <Link href={settingsTabHref(settingsBase, 'workspace')} className="gap-2">
                  <Building2 className="size-4" />
                  Workspace
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={settingsTabHref(settingsBase, 'billing')} className="gap-2">
                  <CreditCard className="size-4" />
                  Billing
                </Link>
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <ThemeMenuRow />
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={logout} className="gap-2">
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
