'use client';

import { AlertCircle, CheckCircle2, Loader2, RefreshCw, UserCheck, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

type SlackUserSyncSectionProps = {
  integrationId: string;
};

export function SlackUserSyncSection({ integrationId }: SlackUserSyncSectionProps) {
  const { data: syncStatus, isLoading: isStatusLoading } = useSyncStatus(integrationId);
  const { data: unmatchedUsers = [], isLoading: isUnmatchedLoading } =
    useUnmatchedUsers(integrationId);
  const { data: employees = [], isLoading: isEmployeesLoading } = useEmployees();

  const triggerSync = useTriggerUserSync();
  const matchUserMutation = useMatchUser();
  const bulkInviteMutation = useBulkInviteUsers();

  const [selectedMembers, setSelectedMembers] = useState<Record<string, string>>({});

  const handleSync = async () => {
    try {
      const result = await triggerSync.mutateAsync(integrationId);
      toast.success(`Sync completed: ${result.matched} matched, ${result.unmatched} unmatched.`);
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

  // Filter out employees who are already matched to make the dropdown cleaner.
  // Note: Since we don't have matched ids in syncStatus, we can filter by matching emails or simply list all active employees.
  // Listing all employees is safer and allows overriding matches.
  const employeeOptions = employees.filter((emp) => emp.status === 'Active');

  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-lg font-medium text-foreground">User Directory Synchronization</h2>
          <p className="text-sm text-muted-foreground">
            Match Slack accounts with HR employee profiles using emails or manual mapping.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={isWorking} onClick={handleSync}>
            {triggerSync.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Sync Roster
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
            Invite Unmatched
          </Button>
        </div>
      </div>

      {syncStatus && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Slack Users</CardDescription>
              <CardTitle className="text-2xl">{syncStatus.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Matched Profiles</CardDescription>
              <CardTitle className="text-2xl text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 className="size-5 text-emerald-600" />
                {syncStatus.matched}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Unmatched Profiles</CardDescription>
              <CardTitle className="text-2xl text-amber-600 flex items-center gap-1.5">
                <AlertCircle className="size-5 text-amber-600" />
                {syncStatus.unmatched}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Match Rate</CardDescription>
              <div className="flex items-baseline justify-between">
                <CardTitle className="text-2xl">{syncStatus.matchRate}%</CardTitle>
              </div>
              <Progress value={syncStatus.matchRate} className="mt-2 h-1.5" />
            </CardHeader>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Unmatched Slack Users</CardTitle>
          <CardDescription>
            These Slack profiles are not connected to any HR employee profile. Map them manually
            below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {unmatchedUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="size-10 text-emerald-500 mb-2" />
              <p className="font-medium text-foreground">All users synchronized!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Every active Slack user is matched with a corresponding HR profile.
              </p>
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Slack Member</TableHead>
                    <TableHead>Email Address</TableHead>
                    <TableHead>Link to Employee Profile</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unmatchedUsers.map((user) => (
                    <TableRow key={user.platformUserId}>
                      <TableCell className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarImage
                            src={user.platformAvatarUrl}
                            alt={user.platformDisplayName || 'Slack User'}
                          />
                          <AvatarFallback className="text-xs">
                            {(user.platformDisplayName || 'U').substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
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
                            <SelectValue placeholder="Select HR Employee..." />
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
