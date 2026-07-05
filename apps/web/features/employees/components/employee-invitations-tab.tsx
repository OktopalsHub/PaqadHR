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

function getInvitationStatusStyles(status: string) {
  switch (status.toUpperCase()) {
    case 'PENDING':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900';
    case 'ACCEPTED':
      return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900';
    case 'DECLINED':
    case 'REVOKED':
    case 'EXPIRED':
      return 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/20 dark:text-gray-400 dark:border-gray-800';
    default:
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900';
  }
}

function invitationDisplayName(firstName?: string | null, lastName?: string | null) {
  return `${firstName ?? ''} ${lastName ?? ''}`.trim();
}

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
            <AppTable className="min-w-[720px]">
              <AppTableHeaderSection>
                <AppTableHeaderRow>
                  <AppTableHeadCell>Invitee</AppTableHeadCell>
                  <AppTableHeadCell>Role</AppTableHeadCell>
                  <AppTableHeadCell>Expires</AppTableHeadCell>
                  <AppTableHeadCell>Status</AppTableHeadCell>
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
                        <div className="min-w-0">
                          {invitationDisplayName(invitation.firstName, invitation.lastName) ? (
                            <>
                              <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                                {invitationDisplayName(invitation.firstName, invitation.lastName)}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {invitation.email}
                              </p>
                            </>
                          ) : (
                            <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                              {invitation.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </AppTableCell>
                    <AppTableCell className="capitalize text-slate-600 dark:text-slate-400">
                      {invitation.role}
                    </AppTableCell>
                    <AppTableCell className="text-slate-600 dark:text-slate-400">
                      {formatDate(String(invitation.expiresAt))}
                    </AppTableCell>
                    <AppTableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${getInvitationStatusStyles(
                          invitation.status,
                        )}`}
                      >
                        <span className="size-1.5 rounded-full bg-current opacity-80" />
                        {invitation.status}
                      </span>
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
                              await resend.mutateAsync(invitation.id);
                              toast.success('Invitation resent');
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
