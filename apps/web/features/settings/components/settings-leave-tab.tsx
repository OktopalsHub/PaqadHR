'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ContentCard } from '@/components/content-card';
import { LoadingBlock } from '@/components/loading-block';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LeaveAssignmentPanel } from '@/features/leaves/components/leave-assignment-panel';
import { LeaveBalancesAdminTab } from '@/features/leaves/components/leave-balances-admin-tab';
import {
  SettingsFieldHint,
  SettingsSwitchRow,
} from '@/features/settings/components/settings-field-hint';
import { SettingsFormActions } from '@/features/settings/components/settings-form-actions';
import {
  useCreateLeaveType,
  useDeleteLeaveType,
  useLeavePolicy,
  useLeaveTypesAdmin,
  useUpdateLeavePolicy,
  useUpdateLeaveType,
} from '@/hooks/queries/use-leave-settings';
import type { LeaveTypeRecord } from '@/lib/api/leave-types';

const CARRYOVER_EXPIRY_OPTIONS = [
  { value: 'none', label: 'Never expires' },
  { value: '1', label: '1 month' },
  { value: '2', label: '2 months' },
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
] as const;

export function SettingsLeaveTab() {
  const { data: policy, isLoading: policyLoading } = useLeavePolicy();
  const { data: types = [], isLoading: typesLoading } = useLeaveTypesAdmin();
  const updatePolicy = useUpdateLeavePolicy();
  const createType = useCreateLeaveType();
  const updateType = useUpdateLeaveType();
  const deleteType = useDeleteLeaveType();

  const [allowCarryover, setAllowCarryover] = useState(false);
  const [maxCarryoverDays, setMaxCarryoverDays] = useState('5');
  const [carryoverExpiryMonths, setCarryoverExpiryMonths] = useState('none');
  const [autoCreateAnnualBalances, setAutoCreateAnnualBalances] = useState(true);
  const [prorateForNewJoiners, setProrateForNewJoiners] = useState(true);
  const [typeName, setTypeName] = useState('');
  const [typeDescription, setTypeDescription] = useState('');
  const [typeDays, setTypeDays] = useState('20');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDays, setEditDays] = useState('20');

  useEffect(() => {
    if (!policy) return;
    setAllowCarryover(policy.allowCarryover);
    setMaxCarryoverDays(String(policy.maxCarryoverDays ?? 5));
    setCarryoverExpiryMonths(
      policy.carryoverExpiryMonths ? String(policy.carryoverExpiryMonths) : 'none',
    );
    setAutoCreateAnnualBalances(policy.autoCreateAnnualBalances);
    setProrateForNewJoiners(policy.prorateForNewJoiners);
  }, [policy]);

  if (policyLoading || typesLoading) return <LoadingBlock />;

  const savePolicy = async () => {
    try {
      await updatePolicy.mutateAsync({
        allowCarryover,
        maxCarryoverDays: allowCarryover ? Number(maxCarryoverDays) || 0 : 0,
        carryoverExpiryMonths: allowCarryover
          ? carryoverExpiryMonths === 'none'
            ? null
            : Number(carryoverExpiryMonths) || null
          : null,
        autoCreateAnnualBalances,
        prorateForNewJoiners,
      });
      toast.success('Leave policy saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save policy');
    }
  };

  const addType = async () => {
    if (!typeName.trim()) {
      toast.error('Enter a leave type name');
      return;
    }
    try {
      await createType.mutateAsync({
        name: typeName.trim(),
        description: typeDescription.trim() || typeName.trim(),
        defaultDays: Number(typeDays) || 0,
      });
      setTypeName('');
      setTypeDescription('');
      toast.success('Leave type added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add leave type');
    }
  };

  const startEdit = (type: LeaveTypeRecord) => {
    setEditingId(type.id);
    setEditName(type.name);
    setEditDescription(type.description);
    setEditDays(String(type.defaultDays));
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) {
      toast.error('Leave type name is required');
      return;
    }
    try {
      await updateType.mutateAsync({
        typeId: editingId,
        input: {
          name: editName.trim(),
          description: editDescription.trim() || editName.trim(),
          defaultDays: Number(editDays) || 0,
        },
      });
      setEditingId(null);
      toast.success('Leave type updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update leave type');
    }
  };

  return (
    <div className="space-y-5">
      <ContentCard title="Leave policy">
        <div className="space-y-4">
          <SettingsSwitchRow
            id="carryover"
            label="Allow carryover"
            checked={allowCarryover}
            onCheckedChange={setAllowCarryover}
          />
          {allowCarryover ? (
            <>
              <SettingsFieldHint label="Max carryover days">
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={maxCarryoverDays}
                  onChange={(e) => setMaxCarryoverDays(e.target.value)}
                />
              </SettingsFieldHint>
              <SettingsFieldHint label="Carryover expires after">
                <Select value={carryoverExpiryMonths} onValueChange={setCarryoverExpiryMonths}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select expiry" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARRYOVER_EXPIRY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsFieldHint>
            </>
          ) : null}
          <SettingsSwitchRow
            id="auto-balances"
            label="Auto-create annual balances"
            checked={autoCreateAnnualBalances}
            onCheckedChange={setAutoCreateAnnualBalances}
          />
          <SettingsSwitchRow
            id="prorate"
            label="Prorate for new joiners"
            checked={prorateForNewJoiners}
            onCheckedChange={setProrateForNewJoiners}
          />
          <SettingsFormActions onSave={savePolicy} isPending={updatePolicy.isPending} />
        </div>
      </ContentCard>

      <ContentCard title="Leave types">
        <div className="space-y-3">
          {types.map((type) => (
            <div key={type.id} className="rounded-lg border border-border/60 p-3">
              {editingId === type.id ? (
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input
                      placeholder="Name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <Input
                      placeholder="Default days"
                      type="number"
                      min={0}
                      value={editDays}
                      onChange={(e) => setEditDays(e.target.value)}
                    />
                    <Input
                      placeholder="Description"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={updateType.isPending} onClick={saveEdit}>
                      Save changes
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {type.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {type.defaultDays} days · {type.description}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(type)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={deleteType.isPending}
                      onClick={() => deleteType.mutateAsync(type.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              placeholder="Name"
              value={typeName}
              onChange={(e) => setTypeName(e.target.value)}
            />
            <Input
              placeholder="Default days"
              value={typeDays}
              onChange={(e) => setTypeDays(e.target.value)}
            />
            <Input
              placeholder="Description"
              value={typeDescription}
              onChange={(e) => setTypeDescription(e.target.value)}
            />
          </div>
          <Button size="sm" disabled={createType.isPending} onClick={addType}>
            Add leave type
          </Button>
        </div>
      </ContentCard>

      <LeaveBalancesAdminTab />
      <LeaveAssignmentPanel />
    </div>
  );
}
