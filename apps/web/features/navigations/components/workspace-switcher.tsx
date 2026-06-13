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

export const WorkspaceSwitcher = () => {
  const { tenant, tenants, setTenantId, isLoading } = useTenant();

  if (isLoading) {
    return <Skeleton className="h-9 w-full" />;
  }

  if (!tenants.length) {
    return (
      <p className="px-2 text-xs text-muted-foreground">No workspace yet</p>
    );
  }

  if (tenants.length === 1) {
    return (
      <p className="truncate px-2 text-sm font-medium">{tenant?.name}</p>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 w-full justify-between px-2 font-normal"
        >
          <span className="truncate">{tenant?.name ?? "Select workspace"}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
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
