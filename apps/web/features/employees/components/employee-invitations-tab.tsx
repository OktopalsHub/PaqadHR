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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
        <AlertTitle>Unable to load invitations</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Something went wrong'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitations</CardTitle>
        <CardDescription>
          Manage pending employee invitations. Resend or revoke invites before they expire.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invitations.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No pending invitations. Use Add employee to invite someone by email.
          </p>
        ) : (
          <AppTablePanel>
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
                          disabled={resend.isPending}
                          aria-label={`Resend invitation to ${invitation.email}`}
                          title="Resend invitation"
                          onClick={async () => {
                            try {
                              const result = await resend.mutateAsync(invitation.id);
                              toastInvitationDelivery(result, {
                                successMessage: 'Invitation resent',
                                failureMessage: 'Invitation updated but email not sent',
                              });
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : 'Failed to resend');
                            }
                          }}
                        >
                          {resend.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <RotateCw className="size-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={revoke.isPending}
                          aria-label={`Revoke invitation to ${invitation.email}`}
                          title="Revoke invitation"
                          onClick={async () => {
                            try {
                              await revoke.mutateAsync(invitation.id);
                              toast.success('Invitation revoked');
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : 'Failed to revoke');
                            }
                          }}
                        >
                          {revoke.isPending ? (
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
          </AppTablePanel>
        )}
      </CardContent>
    </Card>
  );
}
