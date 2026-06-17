'use client';

import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api/client';

export function PrivacySection() {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    try {
      setBusy(true);
      const data = await apiClient<Record<string, unknown>>('/users/me/data-export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `paqad-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('Data export downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    try {
      setBusy(true);
      await apiClient('/users/account', { method: 'DELETE' });
      toast.success('Account deleted');
      window.location.href = '/signin';
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Download a copy of your personal data or permanently delete your account.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={handleExport}>
          <Download className="mr-1 size-4" />
          Download my data
        </Button>
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => setDeleteOpen(true)}>
          <Trash2 className="mr-1 size-4" />
          Delete account
        </Button>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently deletes your login, scrubs linked payment details, and signs you out.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busy} onClick={handleDelete}>
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
