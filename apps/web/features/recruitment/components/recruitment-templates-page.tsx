'use client';

import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { EmailTemplate } from '@/lib/api/recruitment-ats';

import { useDeleteEmailTemplate, useEmailTemplates } from '../hooks/use-recruitment-ats';
import { EmailTemplateDialog } from './email-template-dialog';
import { RecruitmentSectionTabs } from './recruitment-section-tabs';

export function RecruitmentTemplatesPage() {
  const { data: templates, isLoading, error } = useEmailTemplates();
  const remove = useDeleteEmailTemplate();
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [open, setOpen] = useState(false);

  const openEditor = (template: EmailTemplate | null) => {
    setEditing(template);
    setOpen(true);
  };

  const onDelete = (template: EmailTemplate) => {
    remove.mutate(template.id, {
      onSuccess: () => toast.success('Template deleted'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not delete'),
    });
  };

  return (
    <AppPage className="space-y-6">
      <RecruitmentSectionTabs active="templates" />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Email templates</h2>
          <p className="text-sm text-slate-500">
            Reusable messages for candidates. Attach one to a pipeline stage to send it
            automatically.
          </p>
        </div>
        <Button onClick={() => openEditor(null)}>
          <PlusIcon className="size-4" />
          New template
        </Button>
      </div>

      {isLoading ? <LoadingBlock /> : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load templates</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Something went wrong'}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {templates?.map((template) => (
          <Card key={template.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{template.name}</p>
                  <p className="truncate text-sm text-slate-500">{template.subject}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="outline" onClick={() => openEditor(template)}>
                    Edit
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${template.name}`}
                    onClick={() => onDelete(template)}
                    disabled={remove.isPending}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <EmailTemplateDialog open={open} template={editing} onOpenChange={setOpen} />
    </AppPage>
  );
}
