"use client";

import { ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenant } from "@/providers/tenant-provider";

function WorkspaceMark() {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
      P
    </span>
  );
}

export const WorkspaceSwitcher = () => {
  const { tenant, tenants, setTenantId, isLoading } = useTenant();

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
      <div className="flex items-center gap-2.5 px-1">
        <WorkspaceMark />
        <div className="min-w-0 group-data-[collapsible=icon]:hidden">
          <p className="truncate text-sm font-semibold tracking-tight">Paqad</p>
          <p className="truncate text-xs text-muted-foreground">No workspace</p>
        </div>
      </div>
    );
  }

  const trigger = (
    <Button
      variant="ghost"
      className="h-auto w-full justify-start gap-2.5 px-1 py-1.5 font-normal hover:bg-sidebar-accent"
    >
      <WorkspaceMark />
      <div className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
        <p className="truncate text-sm font-semibold tracking-tight">
          {tenant?.name ?? "Paqad"}
        </p>
        <p className="truncate text-xs text-muted-foreground">Workspace</p>
      </div>
      {tenants.length > 1 ? (
        <ChevronsUpDown className="size-4 shrink-0 opacity-50 group-data-[collapsible=icon]:hidden" />
      ) : null}
    </Button>
  );

  if (tenants.length === 1) {
    return <div className="w-full">{trigger}</div>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 rounded-xl">
        {tenants.map((item) => (
          <DropdownMenuItem
            key={item.id}
            onClick={() => setTenantId(item.id)}
            className={item.id === tenant?.id ? "bg-accent" : ""}
          >
            {item.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
