'use client';

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { PipelineStage } from '@/lib/api/recruitment-ats';

import { useAskEmailOnMove } from '../hooks/use-ask-email-on-move';
import { useEmailTemplates, usePipeline, usePipelineMutations } from '../hooks/use-recruitment-ats';
import { stageColor } from '../lib/stage-colors';
import { RecruitmentSectionTabs } from './recruitment-section-tabs';
import { StageColorDot } from './stage-color-dot';
import { StageColorPicker } from './stage-color-picker';

const NO_TEMPLATE = 'none';
const STAGE_TYPES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'] as const;

function notifyError(error: unknown) {
  toast.error(error instanceof Error ? error.message : 'Something went wrong');
}

export function RecruitmentPipelineSettingsPage() {
  const { data: stages, isLoading, error } = usePipeline();
  const { data: templates = [] } = useEmailTemplates();
  const { add, update, reorder, remove } = usePipelineMutations();
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<string>('SCREENING');
  const [askBeforeEmail, setAskBeforeEmail] = useAskEmailOnMove();

  const move = (index: number, direction: -1 | 1) => {
    if (!stages) return;
    const ids = stages.map((stage) => stage.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids, { onError: notifyError });
  };

  const onAdd = () => {
    add.mutate(
      { name: newName.trim(), type: newType },
      {
        onSuccess: () => setNewName(''),
        onError: notifyError,
      },
    );
  };

  const renderStage = (stage: PipelineStage, index: number) => (
    <Card key={stage.id}>
      <CardContent className="flex flex-wrap items-center gap-3 p-3">
        <div className="flex flex-col">
          <Button
            size="icon"
            variant="ghost"
            className="size-6"
            aria-label={`Move ${stage.name} up`}
            onClick={() => move(index, -1)}
            disabled={index === 0 || reorder.isPending}
          >
            <ArrowUpIcon className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-6"
            aria-label={`Move ${stage.name} down`}
            onClick={() => move(index, 1)}
            disabled={index === (stages?.length ?? 0) - 1 || reorder.isPending}
          >
            <ArrowDownIcon className="size-4" />
          </Button>
        </div>
        <div className="min-w-40 flex-1">
          <p className="flex items-center gap-2 font-medium">
            <StageColorDot color={stageColor(stage)} />
            {stage.name}
          </p>
          <p className="text-xs text-slate-500">{stage.type}</p>
        </div>
        <StageColorPicker
          stageName={stage.name}
          value={stageColor(stage)}
          onChange={(color) => update.mutate({ id: stage.id, color }, { onError: notifyError })}
        />
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Auto-email</span>
          <Select
            value={stage.autoEmailTemplateId ?? NO_TEMPLATE}
            onValueChange={(value) =>
              update.mutate(
                { id: stage.id, autoEmailTemplateId: value === NO_TEMPLATE ? null : value },
                { onError: notifyError },
              )
            }
          >
            <SelectTrigger className="w-56" aria-label={`Auto-email for ${stage.name}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_TEMPLATE}>None</SelectItem>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Delete ${stage.name}`}
          onClick={() => remove.mutate(stage.id, { onError: notifyError })}
          disabled={remove.isPending}
        >
          <Trash2Icon className="size-4" />
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <AppPage className="space-y-6">
      <RecruitmentSectionTabs active="pipeline-settings" />
      <div>
        <h2 className="text-lg font-semibold">Hiring pipeline</h2>
        <p className="text-sm text-slate-500">
          Stages every candidate moves through. Each stage maps to a status, and can send an email
          automatically when a candidate enters it.
        </p>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div>
            <p className="font-medium">Ask before emailing candidates</p>
            <p className="text-xs text-slate-500">
              When you move a candidate, show a card asking whether to send them an email. Turn it
              off and moves send the stage&apos;s automatic email instead. This follows your account.
            </p>
          </div>
          <Switch
            checked={askBeforeEmail}
            onCheckedChange={setAskBeforeEmail}
            aria-label="Ask before emailing candidates"
          />
        </CardContent>
      </Card>

      {isLoading ? <LoadingBlock /> : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load the pipeline</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Something went wrong'}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">{stages?.map(renderStage)}</div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-60"
          placeholder="New stage name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Select value={newType} onValueChange={setNewType}>
          <SelectTrigger className="w-40" aria-label="Stage type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAGE_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={onAdd} disabled={!newName.trim() || add.isPending}>
          <PlusIcon className="size-4" />
          Add stage
        </Button>
      </div>
    </AppPage>
  );
}
