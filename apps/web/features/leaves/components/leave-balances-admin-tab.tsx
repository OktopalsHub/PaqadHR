'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useDeleteLeaveBalanceAdmin,
  useLeaveBalancesAdmin,
  useUpdateLeaveBalanceAdmin,
} from '@/hooks/queries/use-leave-balances-admin';
import type { LeaveBalance } from '@/lib/api/leave-balances';

export function LeaveBalancesAdminTab() {
  const { data: balances = [], isLoading } = useLeaveBalancesAdmin();
  const updateBalance = useUpdateLeaveBalanceAdmin();
  const deleteBalance = useDeleteLeaveBalanceAdmin();

  const [editing, setEditing] = useState<LeaveBalance | null>(null);
  const [deleting, setDeleting] = useState<LeaveBalance | null>(null);
  const [totalDays, setTotalDays] = useState('');
  const [usedDays, setUsedDays] = useState('');

  const startEdit = (balance: LeaveBalance) => {
    setEditing(balance);
    setTotalDays(String(balance.totalDays));
    setUsedDays(String(balance.usedDays));
  };

  const handleSave = async () => {
    if (!editing) return;
    const total = parseInt(totalDays, 10);
    const used = parseInt(usedDays, 10);
    if (Number.isNaN(total) || Number.isNaN(used) || total < 0 || used < 0) {
      toast.error('Enter valid day counts');
      return;
    }
    try {
      await updateBalance.mutateAsync({
        balanceId: editing.id,
        input: { totalDays: total, usedDays: used, remainingDays: total - used },
      });
      toast.success('Balance updated');
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update balance');
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteBalance.mutateAsync(deleting.id);
      toast.success('Balance deleted');
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete balance');
    }
  };

  if (isLoading) {
    return <div className="text-muted-foreground py-8 text-center text-sm">Loading balances…</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Employee Leave Balances</CardTitle>
        </CardHeader>
        <CardContent>
          {balances.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No leave balances found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Used</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Year</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">
                      {b.memberName?.trim() || 'Unknown member'}
                    </TableCell>
                    <TableCell>{b.leaveTypeName?.trim() || 'Unknown type'}</TableCell>
                    <TableCell className="text-right">{b.totalDays}</TableCell>
                    <TableCell className="text-right">{b.usedDays}</TableCell>
                    <TableCell className="text-right">{b.remainingDays}</TableCell>
                    <TableCell className="text-right">{b.year}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => startEdit(b)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive h-8 w-8"
                        onClick={() => setDeleting(b)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Leave Balance</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="total-days">Total Days</Label>
              <Input
                id="total-days"
                type="number"
                min={0}
                value={totalDays}
                onChange={(e) => setTotalDays(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="used-days">Used Days</Label>
              <Input
                id="used-days"
                type="number"
                min={0}
                value={usedDays}
                onChange={(e) => setUsedDays(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateBalance.isPending}>
              {updateBalance.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Leave Balance</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this leave balance? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteBalance.isPending}>
              {deleteBalance.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
