'use client';

import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { SearchSelect } from '@/components/search-select';
import { ContentCard } from '@/components/content-card';
import { LoadingBlock } from '@/components/loading-block';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingsFieldHint } from '@/features/settings/components/settings-field-hint';
import { SettingsFormActions } from '@/features/settings/components/settings-form-actions';
import {
  useAddCustomHoliday,
  useHolidaySettings,
  useRemoveCustomHoliday,
  useSupportedHolidayCountries,
  useUpdateHolidaySettings,
} from '@/hooks/queries/use-tenant-settings';

export function SettingsHolidaysTab() {
  const { data: holidays, isLoading } = useHolidaySettings();
  const { data: countriesData } = useSupportedHolidayCountries();
  const updateSettings = useUpdateHolidaySettings();
  const addHoliday = useAddCustomHoliday();
  const removeHoliday = useRemoveCustomHoliday();

  const [countryCode, setCountryCode] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [hasInitializedCountry, setHasInitializedCountry] = useState(false);

  useEffect(() => {
    if (hasInitializedCountry || !holidays) return;
    if (holidays.countryCode) {
      setCountryCode(holidays.countryCode);
    } else if (holidays.suggestedCountryCode) {
      setCountryCode(holidays.suggestedCountryCode);
    }
    setHasInitializedCountry(true);
  }, [holidays, hasInitializedCountry]);

  const countryOptions = useMemo(
    () =>
      (countriesData?.countries ?? []).map((country) => ({
        value: country.code,
        label: country.name,
      })),
    [countriesData?.countries],
  );

  if (isLoading) return <LoadingBlock />;

  const saveCountry = async () => {
    try {
      await updateSettings.mutateAsync({
        countryCode,
        customHolidays: holidays?.customHolidays ?? [],
        excludeWeekends: holidays?.excludeWeekends ?? true,
      });
      toast.success('Holiday country updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const addCustom = async () => {
    if (!holidayName.trim() || !holidayDate) {
      toast.error('Name and date are required');
      return;
    }
    try {
      await addHoliday.mutateAsync({
        name: holidayName.trim(),
        date: holidayDate.slice(5),
        recurring: true,
      });
      setHolidayName('');
      setHolidayDate('');
      toast.success('Custom holiday added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add holiday');
    }
  };

  return (
    <div className="space-y-5">
      <ContentCard title="Public holidays" description="Country used for the schedule calendar">
        <div className="space-y-3">
          <SettingsFieldHint
            label="Country"
            hint="Public holidays for this country appear on the team schedule."
          >
            <SearchSelect
              options={countryOptions}
              value={countryCode}
              onValueChange={setCountryCode}
              placeholder="Select country"
              searchPlaceholder="Search countries…"
            />
          </SettingsFieldHint>
          {!holidays?.countryCode && holidays?.suggestedCountryCode ? (
            <p className="text-xs text-muted-foreground">
              Suggested from your location — save to apply.
            </p>
          ) : null}
          <SettingsFormActions onSave={saveCountry} isPending={updateSettings.isPending} />
        </div>
      </ContentCard>

      <ContentCard title="Custom holidays" description="Company-specific days off">
        <div className="space-y-3">
          {(holidays?.customHolidays ?? []).map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between rounded-lg border border-border/60 p-3"
            >
              <div>
                <p className="font-medium">{h.name}</p>
                <p className="text-xs text-muted-foreground">{h.date}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => removeHoliday.mutateAsync(h.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="Holiday name"
              value={holidayName}
              onChange={(e) => setHolidayName(e.target.value)}
            />
            <Input
              type="date"
              value={holidayDate}
              onChange={(e) => setHolidayDate(e.target.value)}
            />
          </div>
          <Button size="sm" disabled={addHoliday.isPending} onClick={addCustom}>
            Add custom holiday
          </Button>
        </div>
      </ContentCard>
    </div>
  );
}
