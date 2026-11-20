'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Recommendation } from '@/lib/api/recruitment-ats';

import { useScorecards, useSubmitScorecard } from '../../hooks/use-candidate-ats';
import { notifyError } from './candidate-notify';

const RECOMMENDATIONS: Array<{ value: Recommendation; label: string }> = [
  { value: 'STRONG_YES', label: 'Strong yes' },
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
  { value: 'STRONG_NO', label: 'Strong no' },
];

export function CandidateScorecardPanel({ candidateId }: { candidateId: string }) {
  const { data } = useScorecards(candidateId);
  const submit = useSubmitScorecard(candidateId);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [recommendation, setRecommendation] = useState<Recommendation>('YES');
  const [notes, setNotes] = useState('');
  const attributes = data?.attributes ?? [];
  const complete = attributes.length > 0 && attributes.every((name) => ratings[name]);

  return (
    <div className="space-y-4">
      {data && data.summary.count > 0 ? (
        <p className="rounded-md border p-3 text-sm">
          {data.summary.count} scorecard{data.summary.count === 1 ? '' : 's'} · average rating{' '}
          {data.summary.averageRating} / 4 · average recommendation{' '}
          {data.summary.averageRecommendation} / 4
        </p>
      ) : (
        <p className="text-sm text-slate-500">No scorecards yet.</p>
      )}

      {attributes.map((name) => (
        <div key={name} className="flex items-center justify-between gap-3">
          <Label>{name}</Label>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((score) => (
              <Button
                key={score}
                size="sm"
                type="button"
                variant={ratings[name] === score ? 'default' : 'outline'}
                onClick={() => setRatings((current) => ({ ...current, [name]: score }))}
              >
                {score}
              </Button>
            ))}
          </div>
        </div>
      ))}

      <div className="space-y-1.5">
        <Label htmlFor="scorecard-recommendation">Recommendation</Label>
        <select
          id="scorecard-recommendation"
          className="w-full rounded-md border bg-transparent px-2 py-2 text-sm"
          value={recommendation}
          onChange={(e) => setRecommendation(e.target.value as Recommendation)}
        >
          {RECOMMENDATIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <Textarea
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
      />
      <Button
        disabled={!complete || submit.isPending}
        onClick={() =>
          submit.mutate(
            { ratings, recommendation, notes: notes.trim() || undefined },
            {
              onSuccess: () => toast.success('Scorecard saved'),
              onError: (error) => notifyError(error),
            },
          )
        }
      >
        Submit scorecard
      </Button>
    </div>
  );
}
