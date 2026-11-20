'use client';

import { SparklesIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  type EmailTemplate,
  type EmailTone,
  previewEmailTemplate,
} from '@/lib/api/recruitment-ats';

import {
  useDraftEmailWithAi,
  useSaveEmailTemplate,
  useTemplateVariables,
} from '../hooks/use-recruitment-ats';

type Props = {
  open: boolean;
  template: EmailTemplate | null;
  onOpenChange: (open: boolean) => void;
};

const TONES: EmailTone[] = ['friendly', 'formal', 'warm', 'concise'];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function EmailTemplateDialog({ open, template, onOpenChange }: Props) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [purpose, setPurpose] = useState('');
  const [tone, setTone] = useState<EmailTone>('friendly');
  const [previewHtml, setPreviewHtml] = useState('');
  const save = useSaveEmailTemplate();
  const draft = useDraftEmailWithAi();
  const { data: variables = [] } = useTemplateVariables();

  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? '');
    setSubject(template?.subject ?? '');
    setBodyHtml(template?.bodyHtml ?? '');
    setPurpose('');
  }, [open, template]);

  useEffect(() => {
    if (!open || !subject.trim() || !bodyHtml.trim()) {
      setPreviewHtml('');
      return;
    }
    const timer = setTimeout(() => {
      previewEmailTemplate({ subject, bodyHtml })
        .then((result) => setPreviewHtml(result.html))
        .catch(() => setPreviewHtml(''));
    }, 500);
    return () => clearTimeout(timer);
  }, [open, subject, bodyHtml]);

  const insertVariable = (variable: string) => setBodyHtml((value) => `${value}{{${variable}}}`);

  const onDraft = () => {
    draft.mutate(
      { purpose, tone },
      {
        onSuccess: (result) => {
          setSubject(result.subject);
          setBodyHtml(result.bodyHtml);
        },
        onError: (error) => toast.error(errorMessage(error, 'Could not draft the email')),
      },
    );
  };

  const onSave = () => {
    save.mutate(
      { id: template?.id, name, subject, bodyHtml },
      {
        onSuccess: () => {
          toast.success('Template saved');
          onOpenChange(false);
        },
        onError: (error) => toast.error(errorMessage(error, 'Could not save the template')),
      },
    );
  };

  const canSave = name.trim() && subject.trim() && bodyHtml.trim() && !save.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit email template' : 'New email template'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="template-name">Name</Label>
            <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2 rounded-md border border-dashed p-3">
            <Label htmlFor="template-purpose">Draft with AI</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="template-purpose"
                className="min-w-48 flex-1"
                placeholder="e.g. invite a candidate to a first-round interview"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
              <select
                aria-label="Tone"
                className="rounded-md border bg-transparent px-2 text-sm"
                value={tone}
                onChange={(e) => setTone(e.target.value as EmailTone)}
              >
                {TONES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                onClick={onDraft}
                disabled={!purpose.trim() || draft.isPending}
              >
                <SparklesIcon className="size-4" />
                {draft.isPending ? 'Drafting…' : 'Draft'}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="template-subject">Subject</Label>
            <Input
              id="template-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="template-body">Body (HTML)</Label>
            <Textarea
              id="template-body"
              rows={9}
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5">
              {variables.map((variable) => (
                <Button
                  key={variable}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => insertVariable(variable)}
                >
                  {`{{${variable}}}`}
                </Button>
              ))}
            </div>
          </div>
          {previewHtml ? (
            <div className="space-y-1.5">
              <Label>Preview (sample data, final design)</Label>
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={previewHtml}
                className="h-80 w-full rounded-md border bg-white"
              />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!canSave}>
            {save.isPending ? 'Saving…' : 'Save template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
