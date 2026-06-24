'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type SettingsFormActionsProps = {
  onSave: () => void;
  onCancel?: () => void;
  isPending?: boolean;
  saveLabel?: string;
  disabled?: boolean;
};

export function SettingsFormActions({
  onSave,
  onCancel,
  isPending = false,
  saveLabel = 'Save',
  disabled = false,
}: SettingsFormActionsProps) {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <Button disabled={disabled || isPending} onClick={onSave}>
        {isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
        {saveLabel}
      </Button>
      {onCancel ? (
        <Button variant="outline" disabled={isPending} onClick={onCancel}>
          Cancel
        </Button>
      ) : null}
    </div>
  );
}
