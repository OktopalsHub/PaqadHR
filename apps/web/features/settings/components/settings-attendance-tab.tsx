'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ContentCard } from '@/components/content-card';
import { LoadingBlock } from '@/components/loading-block';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  SettingsFieldHint,
} from '@/features/settings/components/settings-field-hint';
import { SettingsFormActions } from '@/features/settings/components/settings-form-actions';
import {
  useAttendancePolicies,
  useCreateAttendancePolicy,
  useDeleteAttendancePolicy,
  useUpdateAttendancePolicy,
} from '@/hooks/queries/use-attendance-policies';
import { usePatchTenantSettings, useTenantSettings } from '@/hooks/queries/use-tenant-settings';
import type { AttendancePolicy } from '@/lib/api/attendance-policies';

const WEEKDAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const EMPTY_POLICY = {
  name: '',
  description: '',
  workStartTime: '09:00',
  workEndTime: '17:00',
  lateThreshold: 15,
  halfDayThreshold: 240,
  gracePeriod: 5,
  maxSessionsPerDay: 3,
};

function formatTime(value: string) {
  return value?.slice(0, 5) ?? value;
}

export function SettingsAttendanceTab() {
  const { data: settings, isLoading: settingsLoading } = useTenantSettings();
  const { data: policies = [], isLoading: policiesLoading } = useAttendancePolicies();
  const patchSettings = usePatchTenantSettings();
  const createPolicy = useCreateAttendancePolicy();
  const updatePolicy = useUpdateAttendancePolicy();
  const deletePolicy = useDeleteAttendancePolicy();

  const [weekends, setWeekends] = useState<number[]>([0, 6]);
  const [clockInEnabled, setClockInEnabled] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_POLICY);

  useEffect(() => {
    const attendance = settings?.settings?.attendance;
    if (attendance?.weekends) {
      setWeekends(attendance.weekends);
    }
    if (attendance?.clockInEnabled !== undefined) {
      setClockInEnabled(attendance.clockInEnabled);
    } else {
      setClockInEnabled(false);
    }
  }, [settings]);

  if (settingsLoading || policiesLoading) return <LoadingBlock />;

  const toggleWeekend = (day: number, checked: boolean) => {
    setWeekends((current) => {
      if (checked) return [...new Set([...current, day])].sort((a, b) => a - b);
      return current.filter((value) => value !== day);
    });
  };

  const saveWeekends = async () => {
    try {
      await patchSettings.mutateAsync({
        attendance: {
          weekends,
          clockInEnabled,
        },
      });
      toast.success('Attendance settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save attendance settings');
    }
  };

  const saveClockInToggle = async (enabled: boolean) => {
    setClockInEnabled(enabled);
    try {
      await patchSettings.mutateAsync({
        attendance: {
          weekends: settings?.settings?.attendance?.weekends ?? weekends,
          clockInEnabled: enabled,
        },
      });
      toast.success(enabled ? 'Clock in enabled' : 'Clock in disabled');
    } catch (err) {
      setClockInEnabled(!enabled);
      toast.error(err instanceof Error ? err.message : 'Failed to update clock in setting');
    }
  };

  const startEdit = (policy: AttendancePolicy) => {
    setEditingId(policy.id);
    setForm({
      name: policy.name,
      description: policy.description,
      workStartTime: formatTime(policy.workStartTime),
      workEndTime: formatTime(policy.workEndTime),
      lateThreshold: policy.lateThreshold,
      halfDayThreshold: policy.halfDayThreshold,
      gracePeriod: policy.gracePeriod,
      maxSessionsPerDay: policy.maxSessionsPerDay,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_POLICY);
  };

  const savePolicy = async () => {
    if (!form.name.trim()) {
      toast.error('Policy name is required');
      return;
    }
    try {
      if (editingId) {
        await updatePolicy.mutateAsync({ policyId: editingId, input: form });
        toast.success('Policy updated');
      } else {
        await createPolicy.mutateAsync(form);
        toast.success('Policy created');
      }
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save policy');
    }
  };

  return (
    <div className="space-y-5">
      <ContentCard
        title="Clock in / out"
        description="Control whether members can track time from the header and Attendance page"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Enable clock in</p>
            <p className="text-xs text-muted-foreground">
              When off, the clock button is hidden and clock-in API calls are blocked.
            </p>
          </div>
          <Switch checked={clockInEnabled} onCheckedChange={saveClockInToggle} />
        </div>
      </ContentCard>

      <ContentCard title="Weekend days" description="Days excluded from working-day calculations">
        <div className="space-y-3">
          {WEEKDAYS.map((day) => (
            <div key={day.value} className="flex items-center justify-between">
              <Label htmlFor={`weekend-${day.value}`}>{day.label}</Label>
              <Switch
                id={`weekend-${day.value}`}
                checked={weekends.includes(day.value)}
                onCheckedChange={(checked) => toggleWeekend(day.value, checked)}
              />
            </div>
          ))}
          <SettingsFormActions onSave={saveWeekends} isPending={patchSettings.isPending} />
        </div>
      </ContentCard>

      <ContentCard title="Attendance policies" description="Work hours and lateness rules">
        <div className="space-y-3">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3"
            >
              <div>
                <p className="font-medium">{policy.name}</p>
                <p className="text-xs text-muted-foreground">{policy.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatTime(policy.workStartTime)} – {formatTime(policy.workEndTime)} · late after{' '}
                  {policy.lateThreshold}m · grace {policy.gracePeriod}m
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => startEdit(policy)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={deletePolicy.isPending}
                  onClick={() => deletePolicy.mutateAsync(policy.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}

          {showForm ? (
            <div className="grid gap-3 rounded-lg border border-border/60 p-4 sm:grid-cols-2">
              <SettingsFieldHint label="Policy name" className="sm:col-span-2">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </SettingsFieldHint>
              <SettingsFieldHint label="Description" className="sm:col-span-2">
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </SettingsFieldHint>
              <SettingsFieldHint label="Work start" hint="Expected clock-in time (24h).">
                <Input
                  type="time"
                  value={form.workStartTime}
                  onChange={(e) => setForm({ ...form, workStartTime: e.target.value })}
                />
              </SettingsFieldHint>
              <SettingsFieldHint label="Work end" hint="Expected clock-out time (24h).">
                <Input
                  type="time"
                  value={form.workEndTime}
                  onChange={(e) => setForm({ ...form, workEndTime: e.target.value })}
                />
              </SettingsFieldHint>
              <SettingsFieldHint label="Late threshold (minutes)" hint="Minutes after start before a session is late.">
                <Input
                  type="number"
                  value={form.lateThreshold}
                  onChange={(e) => setForm({ ...form, lateThreshold: Number(e.target.value) || 0 })}
                />
              </SettingsFieldHint>
              <SettingsFieldHint label="Half-day threshold (minutes)" hint="Worked minutes below this count as half day.">
                <Input
                  type="number"
                  value={form.halfDayThreshold}
                  onChange={(e) => setForm({ ...form, halfDayThreshold: Number(e.target.value) || 0 })}
                />
              </SettingsFieldHint>
              <SettingsFieldHint label="Grace period (minutes)" hint="Allowed lateness before marking late.">
                <Input
                  type="number"
                  value={form.gracePeriod}
                  onChange={(e) => setForm({ ...form, gracePeriod: Number(e.target.value) || 0 })}
                />
              </SettingsFieldHint>
              <SettingsFieldHint label="Max sessions per day" hint="How many clock-in sessions are allowed per day.">
                <Input
                  type="number"
                  value={form.maxSessionsPerDay}
                  onChange={(e) => setForm({ ...form, maxSessionsPerDay: Number(e.target.value) || 1 })}
                />
              </SettingsFieldHint>
              <div className="flex gap-2 sm:col-span-2">
                <Button
                  disabled={createPolicy.isPending || updatePolicy.isPending}
                  onClick={savePolicy}
                >
                  {editingId ? 'Update policy' : 'Add policy'}
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
              Add policy
            </Button>
          )}
        </div>
      </ContentCard>
    </div>
  );
}
