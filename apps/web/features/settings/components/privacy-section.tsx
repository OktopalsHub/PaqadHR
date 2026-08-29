'use client';

import { Download, Trash2 } from 'lucide-react';
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
import { logoutRequest } from '@/lib/api/auth';
import { apiClient, clearCsrfToken } from '@/lib/api/client';
import { clearAppCache } from '@/lib/cache';
import { clearSessionStorage } from '@/lib/session';

const PRIVACY_MAIL = 'privacy@paqad.com';

function privacyMailto(subject: string, body?: string) {
  const params = new URLSearchParams({ subject });
  if (body) {
    params.set('body', body);
  }
  return `mailto:${PRIVACY_MAIL}?${params.toString()}`;
}

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
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Export your data</h3>
        <p className="text-sm text-muted-foreground">
          Download a copy of your account and workspace-linked personal data.
        </p>
        <Button size="sm" variant="outline" disabled={exporting} onClick={handleExport}>
          <Download className="mr-1 size-4" />
          {exporting ? 'Preparing export…' : 'Export my data'}
        </Button>
      </div>

      <div className="space-y-3 border-t border-border pt-6">
        <h3 className="text-sm font-medium">Your data rights</h3>
        <p className="text-sm text-muted-foreground">
          Under GDPR and NDPR you may access, correct, restrict, object to, or request deletion of
          your personal data. Use export above for access, or contact us for other requests.
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Access</strong> — use &quot;Export my data&quot;
            above, or email{' '}
            <a href={privacyMailto('Data access request')} className="text-primary hover:underline">
              {PRIVACY_MAIL}
            </a>
          </li>
          <li>
            <strong className="text-foreground">Correction</strong> — update your profile in
            Settings, or{' '}
            <a
              href={privacyMailto('Data correction request')}
              className="text-primary hover:underline"
            >
              request a correction
            </a>
          </li>
          <li>
            <strong className="text-foreground">Restriction</strong> —{' '}
            <a
              href={privacyMailto('Processing restriction request')}
              className="text-primary hover:underline"
            >
              ask us to limit processing
            </a>
          </li>
          <li>
            <strong className="text-foreground">Objection</strong> —{' '}
            <a
              href={privacyMailto('Processing objection')}
              className="text-primary hover:underline"
            >
              object to certain processing
            </a>
          </li>
          <li>
            <strong className="text-foreground">Deletion</strong> — delete your account below, or
            read our{' '}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>{' '}
            for employer-held records
          </li>
        </ul>
      </div>

      <div className="space-y-3 border-t border-border pt-6">
        <h3 className="text-sm font-medium">Delete your account</h3>
        <p className="text-sm text-muted-foreground">
          Delete your Paqad login. This signs you out everywhere, removes your credentials, and
          scrubs linked payout details. Employment records held by your workspaces may be retained
          by your employer for legal and payroll purposes.
        </p>
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
