'use client';

import { Copy, KeyRound, Loader2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useApiKeyScopes,
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
} from '@/hooks/queries/use-api-keys';
import type { ApiKeyScope } from '@/lib/api/api-keys';
import { getAgentGatewayUrl, getApiOrigin } from '@/lib/api/client';
import { useTenant } from '@/providers/tenant-provider';

function buildMcpConfigSnippet(apiUrl: string, apiKey?: string): string {
  const env: Record<string, string> = {
    PAQADHR_API_URL: apiUrl,
    PAQADHR_API_KEY: apiKey ?? 'paq_...',
  };
  return JSON.stringify(
    {
      mcpServers: {
        paqadhr: {
          command: 'node',
          args: ['packages/mcp-server/dist/index.js'],
          env,
        },
      },
    },
    null,
    2,
  );
}

async function copyText(value: string, successMessage: string) {
  await navigator.clipboard.writeText(value);
  toast.success(successMessage);
}

const SCOPE_LABELS: Record<ApiKeyScope, string> = {
  'employees:read': 'Read employees',
  'leaves:read': 'Read leave balances and requests',
  'leaves:write': 'Submit leave requests',
  'shoutouts:read': 'Read shoutouts',
  'shoutouts:write': 'Send shoutouts',
  'payroll:read': 'Read payroll runs',
  'payroll:write': 'Create payroll runs (requires approval)',
  'approvals:read': 'List pending approvals',
  'approvals:write': 'Approve or reject leave',
  'agent:actions': 'Use agent action gateway',
};

export function ApiKeysSection() {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const agentGatewayUrl = getAgentGatewayUrl();
  const apiOrigin = getApiOrigin();
  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';

  const { data: scopesData } = useApiKeyScopes(tenantId, isAdmin);
  const { data: keys, isLoading } = useApiKeys(tenantId, isAdmin);
  const createKey = useCreateApiKey(tenantId);
  const revokeKey = useRevokeApiKey(tenantId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<ApiKeyScope[]>(['agent:actions']);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);

  const availableScopes = useMemo(() => scopesData?.scopes ?? [], [scopesData]);

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        Only workspace owners and admins can manage API keys.
      </p>
    );
  }

  const toggleScope = (scope: ApiKeyScope) => {
    setSelectedScopes((current) =>
      current.includes(scope) ? current.filter((s) => s !== scope) : [...current, scope],
    );
  };

  const handleCreate = async () => {
    if (!name.trim() || selectedScopes.length === 0) {
      toast.error('Name and at least one scope are required.');
      return;
    }
    try {
      const result = await createKey.mutateAsync({
        name: name.trim(),
        scopes: selectedScopes,
        ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
      });
      setCreatedSecret(result.secret);
      setName('');
      setExpiresAt('');
      setDialogOpen(false);
      toast.success('API key created. Copy the secret now — it will not be shown again.');
    } catch {
      toast.error('Failed to create API key.');
    }
  };

  const copySecret = async () => {
    if (!createdSecret) return;
    await copyText(createdSecret, 'API key copied to clipboard.');
  };

  const copyMcpConfig = async (apiKey?: string) => {
    await copyText(buildMcpConfigSnippet(apiOrigin, apiKey), 'MCP config copied to clipboard.');
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        API keys let automation tools, agents, and integrations access PaqadHR without a browser
        session. Keys are scoped to the agent gateway (see `docs/agent-api-auth.md`) and can be
        revoked at any time.
      </p>

      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <p className="text-sm font-medium">MCP / agent setup</p>
        <p className="text-xs text-muted-foreground">
          Agent tools call this gateway directly (no <code className="text-xs">/api/v1</code> prefix).
          MCP config uses the host only — protect your <code className="text-xs">paq_...</code> key,
          not the URL.
        </p>
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Agent gateway URL</span>
            <div className="flex items-center gap-2">
              <code className="rounded bg-background px-2 py-1 text-xs break-all">{agentGatewayUrl}</code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copyText(agentGatewayUrl, 'Agent gateway URL copied.')}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          {tenantId ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Workspace ID (optional)</span>
              <div className="flex items-center gap-2">
                <code className="rounded bg-background px-2 py-1 text-xs break-all">{tenantId}</code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => copyText(tenantId, 'Workspace ID copied.')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => copyMcpConfig()}>
          <Copy className="mr-1 h-3 w-3" />
          Copy MCP config template
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button type="button">
            <KeyRound className="mr-2 h-4 w-4" />
            Create API key
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              Choose scopes carefully. The secret is shown only once after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key-name">Name</Label>
              <Input
                id="api-key-name"
                placeholder="HR automation bot"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-key-expires">Expires at (optional)</Label>
              <Input
                id="api-key-expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Scopes</Label>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                {availableScopes.map((scope) => (
                  <div key={scope} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      id={`api-key-scope-${scope}`}
                      checked={selectedScopes.includes(scope)}
                      onCheckedChange={() => toggleScope(scope)}
                    />
                    <label htmlFor={`api-key-scope-${scope}`} className="cursor-pointer">
                      <span className="font-medium">{scope}</span>
                      <span className="block text-muted-foreground">{SCOPE_LABELS[scope]}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreate} disabled={createKey.isPending}>
              {createKey.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {createdSecret ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30 space-y-3">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Copy your API key now
          </p>
          <code className="block break-all rounded bg-white/80 p-2 text-xs dark:bg-black/30">
            {createdSecret}
          </code>
          <div>
            <p className="mb-2 text-xs font-medium text-amber-900 dark:text-amber-100">
              Cursor MCP config
            </p>
            <pre className="max-h-48 overflow-auto rounded bg-white/80 p-2 text-xs dark:bg-black/30">
              {buildMcpConfigSnippet(apiOrigin, createdSecret)}
            </pre>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={copySecret}>
              <Copy className="mr-1 h-3 w-3" />
              Copy key
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => copyMcpConfig(createdSecret)}>
              <Copy className="mr-1 h-3 w-3" />
              Copy MCP config
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreatedSecret(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading keys…
        </div>
      ) : keys?.length ? (
        <ul className="divide-y rounded-lg border">
          {keys.map((key) => (
            <li key={key.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="font-medium">{key.name}</p>
                <p className="text-xs text-muted-foreground">
                  {key.keyPrefix}… · {key.scopes.join(', ')}
                </p>
                {key.lastUsedAt ? (
                  <p className="text-xs text-muted-foreground">
                    Last used {new Date(key.lastUsedAt).toLocaleString()}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setRevokeTarget(key.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No API keys yet.</p>
      )}

      <AlertDialog open={Boolean(revokeTarget)} onOpenChange={() => setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
            <AlertDialogDescription>
              Integrations using this key will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!revokeTarget) return;
                try {
                  await revokeKey.mutateAsync(revokeTarget);
                  toast.success('API key revoked.');
                } catch {
                  toast.error('Failed to revoke API key.');
                }
                setRevokeTarget(null);
              }}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
