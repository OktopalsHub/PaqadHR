'use client';

import { SparklesIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { ScreeningResult } from '@/lib/api/recruitment-ats';

import {
  useMoveCandidateStage,
  useScreenCandidate,
  useSendCandidateEmail,
  useToggleTalentPool,
} from '../../hooks/use-candidate-ats';
import { useEmailTemplates, usePipeline } from '../../hooks/use-recruitment-ats';
import { notifyError } from './candidate-notify';

export type DetailCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  stageId?: string | null;
};

const SELECT_CLASS = 'w-full rounded-md border bg-transparent px-2 py-2 text-sm';

export function CandidateOverviewPanel({ candidate }: { candidate: DetailCandidate }) {
  const { data: stages = [] } = usePipeline();
  const { data: templates = [] } = useEmailTemplates();
  const move = useMoveCandidateStage(candidate.id);
  const send = useSendCandidateEmail(candidate.id);
  const screen = useScreenCandidate(candidate.id);
  const pool = useToggleTalentPool(candidate.id);
  const [templateId, setTemplateId] = useState('');
  const [screening, setScreening] = useState<ScreeningResult | null>(null);

  const onSend = () =>
    send.mutate(templateId, {
      onSuccess: (log) =>
        log.status === 'sent'
          ? toast.success('Email sent')
          : toast.error('The email could not be delivered'),
      onError: (error) => notifyError(error),
    });

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="candidate-stage">Stage</Label>
        <select
          id="candidate-stage"
          className={SELECT_CLASS}
          defaultValue={candidate.stageId ?? ''}
          onChange={(e) =>
            e.target.value &&
            move.mutate(e.target.value, {
              onSuccess: () => toast.success('Candidate moved'),
              onError: (error) => notifyError(error),
            })
          }
          disabled={move.isPending}
        >
          <option value="">
            {candidate.stageId ? 'Select a stage' : `Status: ${candidate.status}`}
          </option>
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="candidate-email-template">Send an email</Label>
        <div className="flex gap-2">
          <select
            id="candidate-email-template"
            className={SELECT_CLASS}
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">Choose a template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <Button onClick={onSend} disabled={!templateId || send.isPending}>
            Send
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Button
          variant="outline"
          onClick={() =>
            screen.mutate(undefined, {
              onSuccess: setScreening,
              onError: (error) => notifyError(error, 'AI screening is unavailable'),
            })
          }
          disabled={screen.isPending}
        >
          <SparklesIcon className="size-4" />
          {screen.isPending ? 'Screening…' : 'Screen with AI'}
        </Button>
        {screening ? (
          <div className="space-y-1 rounded-md border p-3 text-sm">
            <p className="font-medium">
              Match {screening.score}/100 · {screening.recommendation}
            </p>
            <p className="text-slate-600">{screening.summary}</p>
            {screening.strengths.length > 0 ? (
              <p>
                <span className="font-medium">Strengths:</span> {screening.strengths.join('; ')}
              </p>
            ) : null}
            {screening.gaps.length > 0 ? (
              <p>
                <span className="font-medium">Gaps:</span> {screening.gaps.join('; ')}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <Button
        variant="ghost"
        onClick={() =>
          pool.mutate(true, {
            onSuccess: () => toast.success('Added to the talent pool'),
            onError: (error) => notifyError(error),
          })
        }
        disabled={pool.isPending}
      >
        Add to talent pool
      </Button>
    </div>
  );
}
