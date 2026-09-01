'use client';

import { CircleAlert, Download, Trash2 } from 'lucide-react';
import Link from 'next/link';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { logoutRequest } from '@/lib/api/auth';
import { apiClient, clearCsrfToken } from '@/lib/api/client';
import { clearAppCache } from '@/lib/cache';
import { clearSessionStorage } from '@/lib/session';

export function PrivacySection() {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    try {
      setExporting(true);
      const data = await apiClient<Record<string, unknown>>('/users/me/data-export');
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `paqad-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('Your data export has been downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const clearClientSession = () => {
    clearAppCache();
    clearSessionStorage();
    clearCsrfToken();
  };

  const handleDelete = async () => {
    try {
      setBusy(true);
      await apiClient('/users/account', { method: 'DELETE' });
      try {
        await logoutRequest();
      } catch {
        // Server unreachable — still clear client state below
      } finally {
        clearClientSession();
      }
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
    <div className="space-y-6">
      <Button size="sm" variant="outline" disabled={exporting} onClick={handleExport}>
        <Download className="mr-1 size-4" />
        {exporting ? 'Preparing export…' : 'Export my data'}
      </Button>

      <div className="space-y-3 border-t border-border pt-6">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-medium">Delete account</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/privacy#your-rights"
                className="inline-flex text-muted-foreground hover:text-foreground"
                aria-label="Your GDPR and NDPR rights and what deletion covers"
              >
                <CircleAlert className="size-3.5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              Your GDPR/NDPR rights and what deletion covers.{' '}
              <span className="text-primary underline">Learn more</span>
            </TooltipContent>
          </Tooltip>
        </div>
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
              This deletes your login, scrubs linked payment details, and signs you out. Workspace
              employment records may remain with your employer. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busy} onClick={handleDelete}>
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
