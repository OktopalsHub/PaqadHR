'use client';

import { Send, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { MemberPointsBalance } from '@/lib/schemas/member-points';
import type { ShoutoutCategory } from '@/lib/schemas/shoutout';
import { cn } from '@/lib/utils';

type EmployeeOption = { id: string; name: string };

type ShoutoutComposerProps = {
  employees: EmployeeOption[];
  categories: ShoutoutCategory[];
  points?: MemberPointsBalance;
  recipientId: string;
  onRecipientChange: (value: string) => void;
  categoryId: string;
  onCategoryChange: (value: string) => void;
  pointsValue: string;
  onPointsChange: (value: string) => void;
  message: string;
  onMessageChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  disabled?: boolean;
  disabledHint?: string;
  className?: string;
};

export function ShoutoutComposer({
  employees,
  categories,
  points,
  recipientId,
  onRecipientChange,
  categoryId,
  onCategoryChange,
  pointsValue,
  onPointsChange,
  message,
  onMessageChange,
  onSubmit,
  isSubmitting,
  disabled = false,
  disabledHint,
  className,
}: ShoutoutComposerProps) {
  const allowance = points?.remainingAllowance;

  return (
    <div className={cn('culture-panel rounded-xl p-4', className)}>
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="size-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Give recognition</h3>
          <p className="text-xs text-muted-foreground">Celebrate someone who made a difference</p>
        </div>
      </div>

      {points ? (
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border bg-background/60 p-3 text-center">
          <div>
            <p className="text-lg font-semibold tabular-nums text-primary">
              {points.remainingAllowance}
            </p>
            <p className="text-[11px] text-muted-foreground">Points to give</p>
          </div>
          <div>
            <p className="text-lg font-semibold tabular-nums">{points.monthlyGiven}</p>
            <p className="text-[11px] text-muted-foreground">Given this month</p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        <div className="space-y-2">
          <Label htmlFor="shoutout-recipient">Who deserves it?</Label>
          <Select value={recipientId} onValueChange={onRecipientChange}>
            <SelectTrigger id="shoutout-recipient" className="bg-background">
              <SelectValue placeholder="Choose a teammate" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {categories.length > 0 ? (
          <div className="space-y-2">
            <Label>Core value</Label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onCategoryChange(category.id)}
                  className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Badge
                    variant="outline"
                    className={cn(
                      'cursor-pointer px-2.5 py-0.5 text-xs transition-colors',
                      categoryId === category.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'hover:bg-muted',
                    )}
                  >
                    {category.name}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="shoutout-points">Points</Label>
          <Input
            id="shoutout-points"
            type="number"
            min={1}
            max={allowance ?? undefined}
            value={pointsValue}
            onChange={(e) => onPointsChange(e.target.value)}
            className="bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="shoutout-message">Your message</Label>
          <Textarea
            id="shoutout-message"
            rows={4}
            placeholder="Thanks for going above and beyond on..."
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            className="resize-none bg-background"
          />
        </div>

        {disabled && disabledHint ? (
          <p className="rounded-lg border border-dashed border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {disabledHint}
          </p>
        ) : null}

        <Button className="w-full" disabled={isSubmitting || disabled} onClick={onSubmit}>
          <Send className="mr-2 size-4" />
          Send shoutout
        </Button>
      </div>
    </div>
  );
}
