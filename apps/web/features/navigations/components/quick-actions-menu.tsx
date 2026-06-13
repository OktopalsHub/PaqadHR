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

const actions = [
  { label: "Add employee", href: "/app/employees", icon: UserPlus },
  { label: "Open roles", href: "/app/recruitment", icon: Briefcase },
  { label: "Run payroll", href: "/app/payroll", icon: Wallet },
  { label: "Send shoutout", href: "/app/shoutouts", icon: Heart },
];

export function QuickActionsMenu() {
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
          <DropdownMenuItem key={action.href} asChild>
            <Link href={action.href} className="gap-2">
              <action.icon className="size-4 text-primary" />
              {action.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
