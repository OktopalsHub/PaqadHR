'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import type { EmailTemplate, MoveStageEmail } from '@/lib/api/recruitment-ats';

import { useAskEmailOnMove } from '../hooks/use-ask-email-on-move';
import type { PendingMove } from '../hooks/use-board-move';
import { stageColor } from '../lib/stage-colors';
import { StageColorDot } from './stage-color-dot';

type MoveEmailDialogProps = {
  pending: PendingMove | null;
  templates: EmailTemplate[];
  onCancel: () => void;
  onConfirm: (move: PendingMove, email: MoveStageEmail) => void;
};

export function MoveEmailDialog({ pending, templates, onCancel, onConfirm }: MoveEmailDialogProps) {
  const tenantHref = useTenantHref();
  const [, setAsk] = useAskEmailOnMove();
  const [sendEmail, setSendEmail] = useState(true);
  const [templateId, setTemplateId] = useState('');
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const active = templates.filter((template) => template.isActive);
  const stageId = pending?.stage.id;
  const defaultTemplateId = pending?.stage.autoEmailTemplateId ?? active[0]?.id ?? '';

  useEffect(() => {
    if (!stageId) return;
    setSendEmail(true);
    setDontAskAgain(false);
    setTemplateId(defaultTemplateId);
  }, [stageId, defaultTemplateId]);

  if (!pending) return null;
  const { candidate, stage } = pending;
  const name = `${candidate.firstName} ${candidate.lastName}`.trim();

  const submit = () => {
    if (dontAskAgain) setAsk(false);
    onConfirm(
      pending,
      sendEmail && templateId
        ? { sendEmail: true, emailTemplateId: templateId }
        : { sendEmail: false },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onCancel())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move {name}</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            To
            <StageColorDot color={stageColor(stage)} />
            <span className="font-medium text-slate-900 dark:text-slate-100">{stage.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <label htmlFor="move-email-switch" className="cursor-pointer text-sm">
              <span className="block font-medium">Email {candidate.firstName} about this</span>
              <span className="block text-xs text-slate-500">Sent to {candidate.email}</span>
            </label>
            <Switch id="move-email-switch" checked={sendEmail} onCheckedChange={setSendEmail} />
          </div>

          {sendEmail ? (
            <div className="space-y-2">
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger aria-label="Email template">
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {active.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Want different wording?{' '}
                <Link
                  href={tenantHref('recruitment/templates')}
                  className="font-medium underline underline-offset-2"
                >
                  Edit email templates
                </Link>
              </p>
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={dontAskAgain}
              onChange={(event) => setDontAskAgain(event.target.checked)}
            />
            Don&apos;t ask me again. Moves will send the stage&apos;s automatic email. You can turn
            this back on in Pipeline settings.
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="brandSolid" onClick={submit} disabled={sendEmail && !templateId}>
            {sendEmail ? 'Move and send email' : 'Move without email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
