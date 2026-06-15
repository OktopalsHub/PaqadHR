"use client";

import Link from "next/link";
import { Briefcase, Heart, Plus, UserPlus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTenantHref } from "@/hooks/use-tenant-nav-items";

export function QuickActionsMenu() {
  const tenantHref = useTenantHref();
  const actions = [
    { label: "Add employee", segment: "employees", icon: UserPlus },
    { label: "Open roles", segment: "recruitment", icon: Briefcase },
    { label: "Run payroll", segment: "payroll", icon: Wallet },
    { label: "Send shoutout", segment: "shoutouts", icon: Heart },
  ] as const;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="size-8 rounded-lg">
          <Plus className="size-4" />
          <span className="sr-only">Quick actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl">
        {actions.map((action) => (
          <DropdownMenuItem key={action.segment} asChild>
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
