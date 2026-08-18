'use client';

import { Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  SettingsFieldHint,
  SettingsSwitchRow,
} from '@/features/settings/components/settings-field-hint';
import { SettingsFormActions } from '@/features/settings/components/settings-form-actions';
import { useAssignPoints } from '@/hooks/queries/use-rewards';
import {
  useCreateShoutoutCategoryAdmin,
  useDeleteShoutoutCategoryAdmin,
  useShoutoutCategoriesAdmin,
} from '@/hooks/queries/use-shoutout-settings';
import {
  useAssignPointsToAll,
  useMembersPoints,
  usePatchTenantSettings,
  useTenantSettings,
} from '@/hooks/queries/use-tenant-settings';
import type { AllowancePeriod, ShoutoutCelebrationTemplate } from '@/lib/api/tenant-settings';
import { PAQ_POINTS_NAME } from '@/lib/constants/paq-points';

const PERIODS: { value: AllowancePeriod; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

const DEFAULT_BIRTHDAY_TEMPLATE: ShoutoutCelebrationTemplate = {
  enabled: true,
  points: 25,
  messageTemplate: 'Happy birthday, {name}! 🎉 Wishing you a wonderful day from the whole team.',
};

const DEFAULT_ANNIVERSARY_TEMPLATE: ShoutoutCelebrationTemplate = {
  enabled: true,
  points: 50,
  messageTemplate:
    'Congratulations on {years} year(s) with us, {name}! 🎊 Thank you for everything you do.',
};

export function SettingsShoutoutsTab() {
  const { data: settings, isLoading } = useTenantSettings();
  const { data: categories = [], isLoading: catsLoading } = useShoutoutCategoriesAdmin();
  const { data: members = [] } = useMembersPoints();
  const patchSettings = usePatchTenantSettings();
  const assignAll = useAssignPointsToAll();
  const createCategory = useCreateShoutoutCategoryAdmin();
  const deleteCategory = useDeleteShoutoutCategoryAdmin();

  const [allowance, setAllowance] = useState('100');
  const [period, setPeriod] = useState<AllowancePeriod>('monthly');
  const [startingBalance, setStartingBalance] = useState('100');
  const [birthdayEnabled, setBirthdayEnabled] = useState(true);
  const [birthdayPoints, setBirthdayPoints] = useState('25');
  const [birthdayMessage, setBirthdayMessage] = useState(DEFAULT_BIRTHDAY_TEMPLATE.messageTemplate);
  const [anniversaryEnabled, setAnniversaryEnabled] = useState(true);
  const [anniversaryPoints, setAnniversaryPoints] = useState('50');
  const [anniversaryMessage, setAnniversaryMessage] = useState(
    DEFAULT_ANNIVERSARY_TEMPLATE.messageTemplate,
  );
  const [categoryName, setCategoryName] = useState('');
  const [bulkPoints, setBulkPoints] = useState('10');
  const [bulkReason, setBulkReason] = useState('');

  const [directPoints, setDirectPoints] = useState('50');
  const [directReason, setDirectReason] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<{ memberId: string; points: number }[]>(
    [],
  );
  const [memberSearch, setMemberSearch] = useState('');
  const [directMode, setDirectMode] = useState<'all' | 'specific'>('all');
  const assignPoints = useAssignPoints();

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members;
    const q = memberSearch.toLowerCase();
    return members.filter((m) =>
      `${m.firstName ?? ''} ${m.lastName ?? ''}`.toLowerCase().includes(q),
    );
  }, [members, memberSearch]);

  useEffect(() => {
    const points = settings?.settings?.points;
    if (points) {
      setAllowance(String(points.monthlyAllowance ?? 100));
      setPeriod(points.allowancePeriod ?? 'monthly');
      setStartingBalance(String(points.startingBalance ?? 100));
    }

    const shoutouts = settings?.settings?.shoutouts;
    if (shoutouts?.birthday) {
      setBirthdayEnabled(shoutouts.birthday.enabled ?? true);
      setBirthdayPoints(String(shoutouts.birthday.points ?? 25));
      setBirthdayMessage(
        shoutouts.birthday.messageTemplate ?? DEFAULT_BIRTHDAY_TEMPLATE.messageTemplate,
      );
    }
    if (shoutouts?.workAnniversary) {
      setAnniversaryEnabled(shoutouts.workAnniversary.enabled ?? true);
      setAnniversaryPoints(String(shoutouts.workAnniversary.points ?? 50));
      setAnniversaryMessage(
        shoutouts.workAnniversary.messageTemplate ?? DEFAULT_ANNIVERSARY_TEMPLATE.messageTemplate,
      );
    }
  }, [settings]);

  if (isLoading || catsLoading) return <LoadingBlock />;

  const savePoints = async () => {
    const existingPoints = settings?.settings?.points;
    try {
      await patchSettings.mutateAsync({
        points: {
          monthlyAllowance: Number(allowance) || 0,
          allowancePeriod: period,
          maxPointsPerShoutout: existingPoints?.maxPointsPerShoutout ?? 50,
          minPointsPerShoutout: existingPoints?.minPointsPerShoutout ?? 1,
          autoAssignPoints: existingPoints?.autoAssignPoints ?? true,
          autoAssignAmount: existingPoints?.autoAssignAmount ?? 0,
          startingBalance: Number(startingBalance) || 0,
        },
      });
      toast.success('Shoutout settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const saveCelebrations = async () => {
    const existingShoutouts = settings?.settings?.shoutouts;
    try {
      await patchSettings.mutateAsync({
        shoutouts: {
          maxRecipientsPerShoutout: existingShoutouts?.maxRecipientsPerShoutout ?? 10,
          enableCategories: existingShoutouts?.enableCategories ?? true,
          birthday: {
            enabled: birthdayEnabled,
            points: Number(birthdayPoints) || 0,
            messageTemplate: birthdayMessage.trim(),
          },
          workAnniversary: {
            enabled: anniversaryEnabled,
            points: Number(anniversaryPoints) || 0,
            messageTemplate: anniversaryMessage.trim(),
          },
        },
      });
      toast.success('Celebration templates saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const addCategory = async () => {
    if (!categoryName.trim()) return;
    try {
      await createCategory.mutateAsync({ name: categoryName.trim() });
      setCategoryName('');
      toast.success('Category added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add category');
    }
  };

  const bulkAssign = async () => {
    const pts = Number(bulkPoints) || 0;
    if (pts < 1) {
      toast.error('Points must be at least 1');
      return;
    }
    try {
      await assignAll.mutateAsync({
        points: pts,
        reason: bulkReason.trim() || undefined,
      });
      toast.success(`Everyone got ${pts} ${PAQ_POINTS_NAME}`);
      setBulkReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk assign failed');
    }
  };

  const addSelectedMember = (memberId: string) => {
    if (selectedMembers.some((a) => a.memberId === memberId)) return;
    setSelectedMembers([...selectedMembers, { memberId, points: Number(directPoints) || 50 }]);
  };

  const removeSelectedMember = (memberId: string) => {
    setSelectedMembers(selectedMembers.filter((a) => a.memberId !== memberId));
  };

  const selectAllFiltered = () => {
    const pts = Number(directPoints) || 50;
    setSelectedMembers(filteredMembers.map((m) => ({ memberId: m.memberId, points: pts })));
  };

  const directAssign = async () => {
    if (selectedMembers.length === 0) {
      toast.error('Select at least one member');
      return;
    }
    try {
      await assignPoints.mutateAsync({
        memberIds: selectedMembers.map((a) => a.memberId),
        points: 0,
        assignments: selectedMembers,
        reason: directReason.trim() || undefined,
      });
      toast.success(`Assigned ${PAQ_POINTS_NAME} to ${selectedMembers.length} member(s)`);
      setSelectedMembers([]);
      setDirectReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Assign failed');
    }
  };

  return (
    <div className="space-y-5">
      <ContentCard title={`${PAQ_POINTS_NAME} allowance`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <SettingsFieldHint label="Allowance amount">
            <Input value={allowance} onChange={(e) => setAllowance(e.target.value)} />
          </SettingsFieldHint>
          <SettingsFieldHint label="Reset period">
            <Select value={period} onValueChange={(v) => setPeriod(v as AllowancePeriod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsFieldHint>
          <SettingsFieldHint label="Starting balance for new members" className="sm:col-span-2">
            <Input value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} />
          </SettingsFieldHint>
          <div className="sm:col-span-2">
            <SettingsFormActions onSave={savePoints} isPending={patchSettings.isPending} />
          </div>
        </div>
      </ContentCard>

      <ContentCard title="Celebration shoutouts">
        <div className="space-y-6">
          <div className="space-y-3 rounded-lg border border-border/60 p-4">
            <SettingsSwitchRow
              id="birthday-enabled"
              label="Birthday shoutouts"
              checked={birthdayEnabled}
              onCheckedChange={setBirthdayEnabled}
            />
            {birthdayEnabled ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <SettingsFieldHint label={`${PAQ_POINTS_NAME} to award`}>
                  <Input
                    value={birthdayPoints}
                    onChange={(e) => setBirthdayPoints(e.target.value)}
                  />
                </SettingsFieldHint>
                <div className="sm:col-span-2">
                  <SettingsFieldHint
                    label="Message template"
                    hint="Use {name} and {company} as placeholders."
                  >
                    <Textarea
                      value={birthdayMessage}
                      onChange={(e) => setBirthdayMessage(e.target.value)}
                      rows={3}
                    />
                  </SettingsFieldHint>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 rounded-lg border border-border/60 p-4">
            <SettingsSwitchRow
              id="anniversary-enabled"
              label="Work anniversary shoutouts"
              checked={anniversaryEnabled}
              onCheckedChange={setAnniversaryEnabled}
            />
            {anniversaryEnabled ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <SettingsFieldHint label={`${PAQ_POINTS_NAME} to award`}>
                  <Input
                    value={anniversaryPoints}
                    onChange={(e) => setAnniversaryPoints(e.target.value)}
                  />
                </SettingsFieldHint>
                <div className="sm:col-span-2">
                  <SettingsFieldHint
                    label="Message template"
                    hint="Use {name}, {years}, and {company} as placeholders."
                  >
                    <Textarea
                      value={anniversaryMessage}
                      onChange={(e) => setAnniversaryMessage(e.target.value)}
                      rows={3}
                    />
                  </SettingsFieldHint>
                </div>
              </div>
            ) : null}
          </div>

          <SettingsFormActions onSave={saveCelebrations} isPending={patchSettings.isPending} />
        </div>
      </ContentCard>

      <ContentCard title="Core values">
        <div className="space-y-3">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between rounded-lg border border-border/60 p-3"
            >
              <span className="font-medium">{cat.name}</span>
              <Button size="sm" variant="ghost" onClick={() => deleteCategory.mutateAsync(cat.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              placeholder="Category name"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
            />
            <Button size="sm" disabled={createCategory.isPending} onClick={addCategory}>
              Add
            </Button>
          </div>
        </div>
      </ContentCard>

      <ContentCard title={`Member ${PAQ_POINTS_NAME.toLowerCase()}`}>
        <div className="flex flex-wrap items-end gap-2">
          <SettingsFieldHint label={`${PAQ_POINTS_NAME} to assign`}>
            <Input
              value={bulkPoints}
              onChange={(e) => setBulkPoints(e.target.value)}
              className="w-32"
            />
          </SettingsFieldHint>
          <SettingsFieldHint label="Reason" className="min-w-[220px] flex-1">
            <Input
              placeholder="e.g. New year celebration"
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
            />
          </SettingsFieldHint>
          <Button disabled={assignAll.isPending} onClick={bulkAssign}>
            Assign to all
          </Button>
        </div>
        {members.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">{members.length} members</p>
        ) : null}

        <div className="mt-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Send to specific members</p>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={directMode === 'all' ? 'default' : 'outline'}
                onClick={() => setDirectMode('all')}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={directMode === 'specific' ? 'default' : 'outline'}
                onClick={() => setDirectMode('specific')}
              >
                Specific
              </Button>
            </div>
          </div>

          {directMode === 'specific' && (
            <div className="mt-3 space-y-3">
              <div className="flex items-end gap-2">
                <SettingsFieldHint label={`${PAQ_POINTS_NAME} per member`} className="w-32">
                  <Input value={directPoints} onChange={(e) => setDirectPoints(e.target.value)} />
                </SettingsFieldHint>
                <SettingsFieldHint label="Reason" className="min-w-[220px] flex-1">
                  <Input
                    placeholder="e.g. Project completion bonus"
                    value={directReason}
                    onChange={(e) => setDirectReason(e.target.value)}
                  />
                </SettingsFieldHint>
                <Button
                  disabled={selectedMembers.length === 0 || assignPoints.isPending}
                  onClick={directAssign}
                >
                  Assign ({selectedMembers.length})
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search members..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {filteredMembers.length} member(s) shown
                </p>
                <Button size="sm" variant="ghost" onClick={selectAllFiltered}>
                  Select all shown
                </Button>
              </div>

              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                {filteredMembers.map((m) => {
                  const isSelected = selectedMembers.some((a) => a.memberId === m.memberId);
                  return (
                    <button
                      key={m.memberId}
                      type="button"
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
                      }`}
                      onClick={() =>
                        isSelected
                          ? removeSelectedMember(m.memberId)
                          : addSelectedMember(m.memberId)
                      }
                    >
                      <span className="font-medium">
                        {m.firstName ?? ''} {m.lastName ?? ''}
                      </span>
                      {isSelected && <X className="size-4 text-muted-foreground" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ContentCard>
    </div>
  );
}
