'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { CandidateOfferPanel } from './candidate-offer-panel';
import { CandidateOverviewPanel, type DetailCandidate } from './candidate-overview-panel';
import { CandidateScorecardPanel } from './candidate-scorecard-panel';
import { CandidateTimelinePanel } from './candidate-timeline-panel';

type Props = {
  candidate: DetailCandidate | null;
  onOpenChange: (open: boolean) => void;
};

export function CandidateDetailSheet({ candidate, onOpenChange }: Props) {
  return (
    <Sheet open={Boolean(candidate)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {candidate ? (
          <>
            <SheetHeader>
              <SheetTitle>
                {candidate.firstName} {candidate.lastName}
              </SheetTitle>
              <p className="text-sm text-slate-500">{candidate.email}</p>
            </SheetHeader>
            <Tabs defaultValue="overview" className="px-4 pb-6">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
                <TabsTrigger value="offer">Offer</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="pt-4">
                <CandidateOverviewPanel key={candidate.id} candidate={candidate} />
              </TabsContent>
              <TabsContent value="scorecard" className="pt-4">
                <CandidateScorecardPanel candidateId={candidate.id} />
              </TabsContent>
              <TabsContent value="offer" className="pt-4">
                <CandidateOfferPanel candidateId={candidate.id} />
              </TabsContent>
              <TabsContent value="timeline" className="pt-4">
                <CandidateTimelinePanel candidateId={candidate.id} />
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
