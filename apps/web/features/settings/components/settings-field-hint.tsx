'use client';

import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function HintIcon({ label, hint }: { label: string; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-pointer text-muted-foreground hover:text-foreground"
          aria-label={`More about ${label}`}
        >
          <CircleAlert className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}

type SettingsFieldHintProps = {
  htmlFor?: string;
  label: string;
  hint?: string;
  children?: ReactNode;
  className?: string;
};

export function SettingsFieldHint({
  htmlFor,
  label,
  hint,
  children,
  className,
}: SettingsFieldHintProps) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-center gap-1.5">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint ? <HintIcon label={label} hint={hint} /> : null}
      </div>
      {children}
    </div>
  );
}

type SettingsSwitchRowProps = {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function SettingsSwitchRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
}: SettingsSwitchRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        {hint ? <HintIcon label={label} hint={hint} /> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
