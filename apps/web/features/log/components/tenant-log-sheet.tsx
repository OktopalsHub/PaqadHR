'use client';

import { ScrollText } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useTenantActivities } from '@/hooks/queries/use-activities';
import { useTenant } from '@/providers/tenant-provider';
import { LogEventCard } from './log-event-card';

export function TenantLogSheet() {
  const { tenant } = useTenant();
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useTenantActivities({
    enabled: open,
    limit: 50,
  });

  const items = data?.items ?? [];
  const slug = tenant?.slug ?? '';

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void refetch();
      }}
    >
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 rounded-lg">
          <ScrollText className="size-4" />
          <span className="sr-only">Workspace log</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4 text-left">
          <SheetTitle>Log</SheetTitle>
          <SheetDescription>Recent workspace actions</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : isError ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Unable to load log events.
            </p>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Workspace actions will appear here.
            </p>
          ) : (
            <div className="pt-1">
              {items.map((activity, index) => (
                <LogEventCard
                  key={activity.id}
                  activity={activity}
                  tenantSlug={slug}
                  isLast={index === items.length - 1}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
