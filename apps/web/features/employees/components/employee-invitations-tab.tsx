'use client';

import { Mail, RotateCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useResendTenantInvitation,
  useRevokeTenantInvitation,
  useTenantInvitations,
} from '@/hooks/queries/use-tenant-invitations';
import { formatDate } from '@/lib/format-date';

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

  if (invitations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No pending invitations. Use Add employee to invite someone by email.
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((invitation) => (
            <TableRow key={invitation.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground" />
                  {invitation.email}
                </div>
              </TableCell>
              <TableCell className="capitalize">{invitation.role}</TableCell>
              <TableCell>{formatDate(String(invitation.expiresAt))}</TableCell>
              <TableCell>
                <Badge variant="secondary" className="capitalize">
                  {invitation.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={resend.isPending}
                    onClick={async () => {
                      try {
                        await resend.mutateAsync(invitation.id);
                        toast.success('Invitation resent');
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Failed to resend');
                      }
                    }}
                  >
                    <RotateCw className="mr-1 size-3.5" />
                    Resend
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={revoke.isPending}
                    onClick={async () => {
                      try {
                        await revoke.mutateAsync(invitation.id);
                        toast.success('Invitation revoked');
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Failed to revoke');
                      }
                    }}
                  >
                    <Trash2 className="mr-1 size-3.5 text-destructive" />
                    Revoke
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
