'use client';

import { AlertCircle, CheckCircle2, Loader2, RefreshCw, UserCheck, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PersonAvatar } from '@/components/person-avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useEmployees } from '@/hooks/queries/use-employees';
import {
  useBulkInviteUsers,
  useMatchUser,
  useSyncStatus,
  useTriggerUserSync,
  useUnmatchedUsers,
} from '@/hooks/queries/use-integrations';
import type { SlackUnmatchedUser } from '@/lib/api/integrations';
import type { Employee } from '@/lib/schemas/employee';

type SlackUserSyncSectionProps = {
  integrationId: string;
};

type LastSyncResult = {
  matched: number;
  unmatched: number;
  created: number;
  errors: number;
};

function getUnmatchedReason(user: SlackUnmatchedUser, employees: Employee[]): string {
  const email = user.platformEmail?.trim().toLowerCase();
  if (!email) {
    return 'No email on Slack profile — link manually or add email in Slack';
  }
  const hasEmployee = employees.some(
    (emp) => emp.status === 'Active' && emp.email?.trim().toLowerCase() === email,
  );
  if (!hasEmployee) {
    return `No employee with email ${user.platformEmail}`;
  }
  return 'Could not auto-match — link manually';
}

export function SlackUserSyncSection({ integrationId }: SlackUserSyncSectionProps) {
  const { data: syncStatus, isLoading: isStatusLoading } = useSyncStatus(integrationId);
  const { data: unmatchedUsers = [], isLoading: isUnmatchedLoading } =
    useUnmatchedUsers(integrationId);
  const { data: employees = [], isLoading: isEmployeesLoading } = useEmployees();

  const triggerSync = useTriggerUserSync();
  const matchUserMutation = useMatchUser();
  const bulkInviteMutation = useBulkInviteUsers();

  const [selectedMembers, setSelectedMembers] = useState<Record<string, string>>({});
  const [lastSyncResult, setLastSyncResult] = useState<LastSyncResult | null>(null);

  const handleSync = async () => {
    try {
      const result = await triggerSync.mutateAsync(integrationId);
      setLastSyncResult(result);
      const total = result.matched + result.unmatched;
      toast.success(`Sync completed: ${result.matched} matched, ${result.unmatched} unmatched.`);
      if (total === 0) {
        toast.message('No Slack users were returned. Reconnect Slack if this persists.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    }
  };

  const handleMatch = async (platformUserId: string) => {
    const tenantMemberId = selectedMembers[platformUserId];
    if (!tenantMemberId) {
      toast.error('Please select an employee to link');
      return;
    }
    try {
      await matchUserMutation.mutateAsync({
        integrationId,
        platformUserId,
        tenantMemberId,
      });
      toast.success('Member linked successfully');
      setSelectedMembers((prev) => {
        const next = { ...prev };
        delete next[platformUserId];
        return next;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to link member');
    }
  };

  const handleBulkInvite = async () => {
    try {
      const result = await bulkInviteMutation.mutateAsync(integrationId);
      toast.success(`Invites sent: ${result.sent} successful, ${result.failed} failed.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk invite failed');
    }
  };

  const isWorking =
    triggerSync.isPending || matchUserMutation.isPending || bulkInviteMutation.isPending;

  if (isStatusLoading || isUnmatchedLoading || isEmployeesLoading) {
    return (
      <div className="flex h-32 items-center justify-center space-x-2">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading sync status...</span>
      </div>
    );
  }

  const employeeOptions = employees.filter((emp) => emp.status === 'Active');
  const displayTotal = syncStatus?.total ?? 0;

  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-lg font-medium text-foreground">User sync</h2>
          <p className="text-sm text-muted-foreground">Match Slack users to employees</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={isWorking} onClick={handleSync}>
            {triggerSync.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Sync
          </Button>
          <Button
            size="sm"
            disabled={isWorking || unmatchedUsers.length === 0}
            onClick={handleBulkInvite}
          >
            {bulkInviteMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 size-4" />
            )}
            Invite unmatched
          </Button>
        </div>
      </div>

      {syncStatus && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Slack users</CardDescription>
              <CardTitle className="text-2xl">{syncStatus.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Matched</CardDescription>
              <CardTitle className="text-2xl text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 className="size-5 text-emerald-600" />
                {syncStatus.matched}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Unmatched</CardDescription>
              <CardTitle className="text-2xl text-amber-600 flex items-center gap-1.5">
                <AlertCircle className="size-5 text-amber-600" />
                {syncStatus.unmatched}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Match rate</CardDescription>
              <div className="flex items-baseline justify-between">
                <CardTitle className="text-2xl">{syncStatus.matchRate}%</CardTitle>
              </div>
              <Progress value={syncStatus.matchRate} className="mt-2 h-1.5" />
            </CardHeader>
          </Card>
        </div>
      )}

      {lastSyncResult ? (
        <p className="text-sm text-muted-foreground">
          Last sync: {lastSyncResult.matched + lastSyncResult.unmatched} Slack users —{' '}
          {lastSyncResult.matched} matched, {lastSyncResult.unmatched} unmatched
          {lastSyncResult.errors > 0 ? `, ${lastSyncResult.errors} errors` : ''}.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Unmatched</CardTitle>
          <CardDescription>Map Slack users to employees</CardDescription>
        </CardHeader>
        <CardContent>
          {displayTotal === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <RefreshCw className="size-10 text-muted-foreground mb-2" />
              <p className="font-medium text-foreground">No Slack users synced yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Click Sync to pull users from Slack
              </p>
            </div>
          ) : unmatchedUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="size-10 text-emerald-500 mb-2" />
              <p className="font-medium text-foreground">All users matched</p>
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Slack member</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Link to employee</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unmatchedUsers.map((user) => (
                    <TableRow key={user.platformUserId}>
                      <TableCell className="flex items-center gap-3">
                        <PersonAvatar
                          src={user.platformAvatarUrl}
                          name={user.platformDisplayName || user.platformUsername || 'Slack user'}
                          className="size-8"
                          fallbackClassName="text-xs"
                        />
                        <div>
                          <p className="text-sm font-medium leading-none">
                            {user.platformDisplayName || user.platformUsername}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            @{user.platformUsername}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {user.platformEmail || (
                          <span className="text-muted-foreground italic">No email</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[220px]">
                        {getUnmatchedReason(user, employees)}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={selectedMembers[user.platformUserId] || ''}
                          onValueChange={(val) =>
                            setSelectedMembers((prev) => ({
                              ...prev,
                              [user.platformUserId]: val,
                            }))
                          }
                        >
                          <SelectTrigger className="w-[240px] h-9">
                            <SelectValue placeholder="Select employee…" />
                          </SelectTrigger>
                          <SelectContent>
                            {employeeOptions.map((emp) => (
                              <SelectItem key={emp.id} value={emp.id}>
                                {emp.name} ({emp.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isWorking || !selectedMembers[user.platformUserId]}
                          onClick={() => handleMatch(user.platformUserId)}
                          className="h-9 px-3"
                        >
                          {matchUserMutation.isPending && selectedMembers[user.platformUserId] ? (
                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
                          ) : (
                            <>
                              <UserCheck className="mr-1.5 size-4" />
                              Link
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
