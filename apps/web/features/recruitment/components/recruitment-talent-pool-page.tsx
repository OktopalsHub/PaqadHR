'use client';

import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { setTalentPool } from '@/lib/api/recruitment-ats';

import { useTalentPool } from '../hooks/use-candidate-ats';
import { RecruitmentSectionTabs } from './recruitment-section-tabs';

export function RecruitmentTalentPoolPage() {
  const { data: people, isLoading, error } = useTalentPool();
  const queryClient = useQueryClient();

  const remove = async (id: string) => {
    try {
      await setTalentPool(id, false);
      await queryClient.invalidateQueries({ queryKey: ['recruitment', 'talent-pool'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the talent pool');
    }
  };

  return (
    <AppPage className="space-y-6">
      <RecruitmentSectionTabs active="talent-pool" />
      <div>
        <h2 className="text-lg font-semibold">Talent pool</h2>
        <p className="text-sm text-slate-500">
          Promising candidates you want to keep in touch with. Add people from the candidate panel.
        </p>
      </div>
      {isLoading ? <LoadingBlock /> : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load the talent pool</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Something went wrong'}
          </AlertDescription>
        </Alert>
      ) : null}
      {people && people.length === 0 ? (
        <p className="text-sm text-slate-500">Nobody is in the talent pool yet.</p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {people?.map((person) => (
          <Card key={person.id}>
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {person.firstName} {person.lastName}
                </p>
                <p className="truncate text-sm text-slate-500">{person.email}</p>
                {person.skills ? (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{person.skills}</p>
                ) : null}
              </div>
              <Button size="sm" variant="outline" onClick={() => remove(person.id)}>
                Remove
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppPage>
  );
}
