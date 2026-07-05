import { Suspense } from 'react';
import { LoadingBlock } from '@/components/loading-block';
import { AcceptInvitePage } from '@/features/invitations/components/accept-invite-page';

export default function AcceptInviteRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="py-12">
          <LoadingBlock />
        </div>
      }
    >
      <AcceptInvitePage />
    </Suspense>
  );
}
