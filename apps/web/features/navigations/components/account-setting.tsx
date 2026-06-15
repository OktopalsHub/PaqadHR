"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import {
  memberFullName,
  memberInitials,
  useMemberProfile,
} from "@/hooks/queries/use-member-profile";
import { useTenantHref } from "@/hooks/use-tenant-nav-items";
import { ThemeMenuItem } from "./theme-switcher";

export const AccountSetting = ({ logout }: { logout: () => void }) => {
  const { user } = useAuth();
  const { data: profile } = useMemberProfile();
  const name = memberFullName(profile, user?.name);
  const initials = memberInitials(profile, user?.name);
  const position = profile?.position?.title?.trim();
  const settingsHref = useTenantHref()("settings");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 outline-none transition-colors hover:bg-muted/60"
        >
          <Avatar className="size-8 shrink-0">
            <AvatarImage src={profile?.avatarUrl ?? undefined} alt={name} />
            <AvatarFallback className="bg-muted text-xs font-medium text-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 max-w-[140px] text-left lg:block">
            <p className="truncate text-sm font-semibold leading-tight">
              {name}
            </p>
            {position ? (
              <p className="truncate text-xs leading-tight text-muted-foreground">
                {position}
              </p>
            ) : null}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-56 rounded-xl"
        align="end"
        sideOffset={4}
      >
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href={settingsHref}>Settings</Link>
          </DropdownMenuItem>
          <ThemeMenuItem />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
