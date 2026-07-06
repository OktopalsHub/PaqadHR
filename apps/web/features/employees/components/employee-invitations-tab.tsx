'use client';

import { Loader2, Mail, RotateCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AppTable,
  AppTableBodyRow,
  AppTableBodySection,
  AppTableCell,
  AppTableHeadCell,
  AppTableHeaderRow,
  AppTableHeaderSection,
  AppTablePanel,
} from '@/components/ui/app-table';
import { Button } from '@/components/ui/button';
import {
  useResendTenantInvitation,
  useRevokeTenantInvitation,
  useTenantInvitations,
} from '@/hooks/queries/use-tenant-invitations';
import { formatDate } from '@/lib/format-date';
import { toastInvitationDelivery } from '@/lib/invitation-delivery';

export function EmployeeInvitationsTab() {
  const { data: invitations = [], isLoading, isError, error } = useTenantInvitations('pending');
  const resend = useResendTenantInvitation();
  const revoke = useRevokeTenantInvitation();

  if (isLoading) {
    return <LoadingBlock />;
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load invites</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Something went wrong'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <AppTablePanel>
      {invitations.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No pending invites</p>
      ) : (
        <AppTable className="min-w-[640px]">
          <AppTableHeaderSection>
            <AppTableHeaderRow>
              <AppTableHeadCell>Email</AppTableHeadCell>
              <AppTableHeadCell>Role</AppTableHeadCell>
              <AppTableHeadCell>Expires</AppTableHeadCell>
              <AppTableHeadCell className="text-right">Actions</AppTableHeadCell>
            </AppTableHeaderRow>
          </AppTableHeaderSection>
          <AppTableBodySection>
            {invitations.map((invitation) => (
              <AppTableBodyRow key={invitation.id}>
                <AppTableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                      <Mail className="size-3.5" />
                    </div>
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                      {invitation.email}
                    </p>
                  </div>
                </AppTableCell>
                <AppTableCell className="capitalize text-slate-600 dark:text-slate-400">
                  {invitation.role}
                </AppTableCell>
                <AppTableCell className="text-slate-600 dark:text-slate-400">
                  {formatDate(String(invitation.expiresAt))}
                </AppTableCell>
                <AppTableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={resend.isPending || revoke.isPending}
                      aria-label={`Resend invite to ${invitation.email}`}
                      title="Resend"
                      onClick={async () => {
                        try {
                          const result = await resend.mutateAsync(invitation.id);
                          toastInvitationDelivery(result, {
                            successMessage: 'Invite resent',
                            failureMessage: 'Invite updated — email not sent',
                          });
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Resend failed');
                        }
                      }}
                    >
                      {resend.isPending && resend.variables === invitation.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RotateCw className="size-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={resend.isPending || revoke.isPending}
                      aria-label={`Revoke invite to ${invitation.email}`}
                      title="Revoke"
                      onClick={async () => {
                        try {
                          await revoke.mutateAsync(invitation.id);
                          toast.success('Invite revoked');
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Revoke failed');
                        }
                      }}
                    >
                      {revoke.isPending && revoke.variables === invitation.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4 text-destructive" />
                      )}
                    </Button>
                  </div>
                </AppTableCell>
              </AppTableBodyRow>
            ))}
          </AppTableBodySection>
        </AppTable>
      )}
    </AppTablePanel>
  );
}
