'use client';

import { Trash2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  SettingsFieldHint,
  SettingsSwitchRow,
} from '@/features/settings/components/settings-field-hint';
import { SettingsFormActions } from '@/features/settings/components/settings-form-actions';
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
    try {
      await assignAll.mutateAsync({
        points: Number(bulkPoints) || 0,
        reason: bulkReason.trim() || undefined,
      });
      toast.success(`Everyone got ${Number(bulkPoints) || 0} ${PAQ_POINTS_NAME}`);
      setBulkReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk assign failed');
    }
  };

  return (
    <div className="space-y-5">
      <ContentCard
        title={`${PAQ_POINTS_NAME} allowance`}
        description={`How many ${PAQ_POINTS_NAME.toLowerCase()} members can give per period`}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <SettingsFieldHint
            label="Allowance amount"
            hint={`Total ${PAQ_POINTS_NAME.toLowerCase()} each member can give during the selected reset period.`}
          >
            <Input value={allowance} onChange={(e) => setAllowance(e.target.value)} />
          </SettingsFieldHint>
          <SettingsFieldHint
            label="Reset period"
            hint="How often member shoutout allowances reset."
          >
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
          <SettingsFieldHint
            label="Starting balance for new members"
            hint={`${PAQ_POINTS_NAME} every new employee receives when they join the workspace.`}
            className="sm:col-span-2"
          >
            <Input value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} />
          </SettingsFieldHint>
          <div className="sm:col-span-2">
            <SettingsFormActions onSave={savePoints} isPending={patchSettings.isPending} />
          </div>
        </div>
      </ContentCard>

      <ContentCard
        title="Celebration shoutouts"
        description={`Automated shoutouts and ${PAQ_POINTS_NAME.toLowerCase()} on birthdays and work anniversaries`}
      >
        <div className="space-y-6">
          <div className="space-y-3 rounded-lg border border-border/60 p-4">
            <SettingsSwitchRow
              id="birthday-enabled"
              label="Birthday shoutouts"
              hint={`Post a shoutout and award ${PAQ_POINTS_NAME.toLowerCase()} when it is a member's birthday.`}
              checked={birthdayEnabled}
              onCheckedChange={setBirthdayEnabled}
            />
            {birthdayEnabled ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <SettingsFieldHint
                  label={`${PAQ_POINTS_NAME} to award`}
                  hint={`${PAQ_POINTS_NAME} granted to the birthday person.`}
                >
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
              hint={`Post a shoutout and award ${PAQ_POINTS_NAME.toLowerCase()} on each member's work anniversary.`}
              checked={anniversaryEnabled}
              onCheckedChange={setAnniversaryEnabled}
            />
            {anniversaryEnabled ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <SettingsFieldHint
                  label={`${PAQ_POINTS_NAME} to award`}
                  hint={`${PAQ_POINTS_NAME} granted on each anniversary.`}
                >
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

      <ContentCard title="Core values" description="Categories for shoutouts">
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

      <ContentCard
        title={`Member ${PAQ_POINTS_NAME.toLowerCase()}`}
        description={`Assign bonus ${PAQ_POINTS_NAME.toLowerCase()} to everyone in the workspace`}
      >
        <div className="flex flex-wrap items-end gap-2">
          <SettingsFieldHint label={`${PAQ_POINTS_NAME} to assign`}>
            <Input
              value={bulkPoints}
              onChange={(e) => setBulkPoints(e.target.value)}
              className="w-32"
            />
          </SettingsFieldHint>
          <SettingsFieldHint
            label="Reason"
            hint="Shown to members and in the activity log."
            className="min-w-[220px] flex-1"
          >
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
          <p className="mt-3 text-xs text-muted-foreground">
            Applies to all {members.length} members in the workspace
          </p>
        ) : null}
      </ContentCard>
    </div>
  );
}
