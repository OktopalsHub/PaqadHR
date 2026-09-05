'use client';

import { useQueryClient } from '@tanstack/react-query';
import type { Locale } from 'date-fns';
import { ar, de, es, fr, ja } from 'date-fns/locale';
import { Eye, Pencil, Plus, Settings2, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppPage } from '@/components/app-page';
import { EventCalendar } from '@/components/reui/event-calendar/event-calendar';
import { EventCalendarContent } from '@/components/reui/event-calendar/event-calendar-content';
import type { EventCalendarI18nConfig } from '@/components/reui/event-calendar/event-calendar-i18n';
import {
  EventCalendarNav,
  EventCalendarToolbar,
} from '@/components/reui/event-calendar/event-calendar-nav';
import type {
  EventCalendarInteractions,
  EventCalendarViewSettings,
  CalendarView as ReuiCalendarView,
} from '@/components/reui/event-calendar/event-calendar-types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AddCalendarEventDialog } from '@/features/calenders/components/add-calendar-event-dialog';
import {
  type PaqadEventMeta,
  paqadEventsToReui,
} from '@/features/calenders/lib/calendar-reui-mapper';
import { formatDateKey } from '@/features/calenders/lib/calendar-utils';
import { useCalendarEvents } from '@/hooks/queries/use-calendar';
import { type CalendarEventRecord, deleteCalendarEvent } from '@/lib/api/calendar-events';
import { formatDate } from '@/lib/format-date';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';
import { CalendarToolbar } from './calendar-toolbar';

const DEFAULT_FILTERS = {
  leave: true,
  holiday: true,
  meeting: true,
  review: true,
  celebration: true,
};

/** i18n presets - a date-fns locale for formatted dates plus overrides for the
 *  static UI strings. Arabic also flips the calendar to right-to-left. */
type CalendarI18nOverride = {
  labels?: Partial<EventCalendarI18nConfig['labels']>;
  viewNames?: Partial<EventCalendarI18nConfig['viewNames']>;
};

interface CalendarLocale {
  id: string;
  label: string;
  locale: Locale | undefined;
  dir: 'ltr' | 'rtl';
  i18n: CalendarI18nOverride | undefined;
}

const LOCALES: CalendarLocale[] = [
  { id: 'en', label: 'English', locale: undefined, dir: 'ltr', i18n: undefined },
  {
    id: 'de',
    label: 'Deutsch',
    locale: de,
    dir: 'ltr',
    i18n: {
      labels: {
        today: 'Heute',
        allDay: 'Ganztägig',
        noEvents: 'Keine Termine',
        more: (count) => `+${count} weitere`,
      },
      viewNames: {
        month: 'Monat',
        week: 'Woche',
        day: 'Tag',
        days: (count) => `${count} Tage`,
        agenda: 'Agenda',
        resource: 'Zeitraster',
      },
    },
  },
  {
    id: 'fr',
    label: 'Français',
    locale: fr,
    dir: 'ltr',
    i18n: {
      labels: {
        today: "Aujourd'hui",
        allDay: 'Journée entière',
        noEvents: 'Aucun événement',
        more: (count) => `+${count} autres`,
      },
      viewNames: {
        month: 'Mois',
        week: 'Semaine',
        day: 'Jour',
        days: (count) => `${count} jours`,
        agenda: 'Agenda',
        resource: 'Grille horaire',
      },
    },
  },
  {
    id: 'es',
    label: 'Español',
    locale: es,
    dir: 'ltr',
    i18n: {
      labels: {
        today: 'Hoy',
        allDay: 'Todo el día',
        noEvents: 'Sin eventos',
        more: (count) => `+${count} más`,
      },
      viewNames: {
        month: 'Mes',
        week: 'Semana',
        day: 'Día',
        days: (count) => `${count} días`,
        agenda: 'Agenda',
        resource: 'Cuadrícula',
      },
    },
  },
  {
    id: 'ja',
    label: '日本語',
    locale: ja,
    dir: 'ltr',
    i18n: {
      labels: {
        today: '今日',
        allDay: '終日',
        noEvents: '予定なし',
        more: (count) => `他${count}件`,
      },
      viewNames: {
        month: '月',
        week: '週',
        day: '日',
        days: (count) => `${count}日間`,
        agenda: '予定',
        resource: 'タイムグリッド',
      },
    },
  },
  {
    id: 'ar',
    label: 'العربية',
    locale: ar,
    dir: 'rtl',
    i18n: {
      labels: {
        today: 'اليوم',
        allDay: 'طوال اليوم',
        noEvents: 'لا توجد أحداث',
        more: (count) => `+${count} المزيد`,
      },
      viewNames: {
        month: 'شهر',
        week: 'أسبوع',
        day: 'يوم',
        days: (count) => `${count} أيام`,
        agenda: 'جدول الأعمال',
        resource: 'شبكة زمنية',
      },
    },
  },
];

/** Display time zones - switching visibly shifts every event's clock time. */
const TIME_ZONES: Array<{ id: string; label: string; value?: string }> = [
  { id: 'local', label: 'Browser' },
  { id: 'lagos', label: 'Lagos', value: 'Africa/Lagos' },
  { id: 'london', label: 'London', value: 'Europe/London' },
  { id: 'ny', label: 'New York', value: 'America/New_York' },
  { id: 'tokyo', label: 'Tokyo', value: 'Asia/Tokyo' },
  { id: 'kolkata', label: 'Kolkata', value: 'Asia/Kolkata' },
];

/** Everything the settings panel drives, as one resettable object. */
interface CalendarSettings {
  viewSettings: EventCalendarViewSettings;
  interactions: EventCalendarInteractions;
  weekStartsOn: 0 | 1;
  dayStartHour: number;
  dayEndHour: number;
  interval: number;
  snapDuration: number;
  eventTooltip: boolean;
  showDayAddButton: boolean;
  localeId: string;
  timeZoneId: string;
}

const DEFAULT_SETTINGS: CalendarSettings = {
  viewSettings: {
    weekends: true,
    weekNumbers: false,
    nowIndicator: true,
    offDays: false,
  },
  interactions: { drag: false, resize: false, selectSlot: true },
  weekStartsOn: 1,
  dayStartHour: 0,
  dayEndHour: 24,
  interval: 60,
  snapDuration: 15,
  eventTooltip: true,
  showDayAddButton: true,
  localeId: 'en',
  timeZoneId: 'local',
};

// The first client render must match SSR because the calendar reads browser
// time-zone/date values. Keep that guard satisfied for later in-app visits.
let hasCalendarClientHydrated = false;

function SettingsSwitch({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SettingsSelect({
  id,
  label,
  value,
  options,
  onValueChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} size="sm" className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CalendarSettingsPopover({
  settings,
  onChange,
  isTimeGridView,
}: {
  settings: CalendarSettings;
  onChange: (settings: CalendarSettings) => void;
  isTimeGridView: boolean;
}) {
  const patch = (partial: Partial<CalendarSettings>) => onChange({ ...settings, ...partial });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="size-4" aria-hidden="true" />
          Settings
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80">
        <Tabs defaultValue="view">
          <TabsList className="w-full">
            <TabsTrigger value="view" className="flex-1">
              View
            </TabsTrigger>
            {isTimeGridView && (
              <TabsTrigger value="time" className="flex-1">
                Time grid
              </TabsTrigger>
            )}
            <TabsTrigger value="behavior" className="flex-1">
              Behavior
            </TabsTrigger>
            <TabsTrigger value="region" className="flex-1">
              Region
            </TabsTrigger>
          </TabsList>
          <TabsContent value="view" className="flex flex-col gap-3">
            <SettingsSwitch
              id="ec-set-weekends"
              label="Weekends"
              checked={settings.viewSettings.weekends ?? true}
              onCheckedChange={(weekends) =>
                patch({ viewSettings: { ...settings.viewSettings, weekends } })
              }
            />
            <SettingsSwitch
              id="ec-set-week-numbers"
              label="Week numbers"
              checked={settings.viewSettings.weekNumbers ?? false}
              onCheckedChange={(weekNumbers) =>
                patch({ viewSettings: { ...settings.viewSettings, weekNumbers } })
              }
            />
            <SettingsSwitch
              id="ec-set-now"
              label="Now indicator"
              checked={settings.viewSettings.nowIndicator ?? true}
              onCheckedChange={(nowIndicator) =>
                patch({ viewSettings: { ...settings.viewSettings, nowIndicator } })
              }
            />
            <SettingsSwitch
              id="ec-set-off-days"
              label="Mark off days"
              checked={settings.viewSettings.offDays ?? false}
              onCheckedChange={(offDays) =>
                patch({ viewSettings: { ...settings.viewSettings, offDays } })
              }
            />
            <SettingsSwitch
              id="ec-set-day-add"
              label="Day add button"
              checked={settings.showDayAddButton}
              onCheckedChange={(showDayAddButton) => patch({ showDayAddButton })}
            />
            <SettingsSelect
              id="ec-set-week-start"
              label="Week starts"
              value={String(settings.weekStartsOn)}
              options={[
                { value: '0', label: 'Sunday' },
                { value: '1', label: 'Monday' },
              ]}
              onValueChange={(weekStartsOn) =>
                patch({ weekStartsOn: Number(weekStartsOn) as 0 | 1 })
              }
            />
          </TabsContent>
          <TabsContent value="time" className="flex flex-col gap-3">
            <SettingsSelect
              id="ec-set-day-start"
              label="Day starts"
              value={String(settings.dayStartHour)}
              options={[
                { value: '0', label: '00:00' },
                { value: '6', label: '06:00' },
                { value: '8', label: '08:00' },
              ]}
              onValueChange={(dayStartHour) => patch({ dayStartHour: Number(dayStartHour) })}
            />
            <SettingsSelect
              id="ec-set-day-end"
              label="Day ends"
              value={String(settings.dayEndHour)}
              options={[
                { value: '18', label: '18:00' },
                { value: '20', label: '20:00' },
                { value: '24', label: '24:00' },
              ]}
              onValueChange={(dayEndHour) => patch({ dayEndHour: Number(dayEndHour) })}
            />
            <SettingsSelect
              id="ec-set-interval"
              label="Grid interval"
              value={String(settings.interval)}
              options={[
                { value: '30', label: '30 min' },
                { value: '60', label: '60 min' },
              ]}
              onValueChange={(interval) => patch({ interval: Number(interval) })}
            />
            <SettingsSelect
              id="ec-set-snap"
              label="Drag snap"
              value={String(settings.snapDuration)}
              options={[
                { value: '5', label: '5 min' },
                { value: '15', label: '15 min' },
                { value: '30', label: '30 min' },
              ]}
              onValueChange={(snapDuration) => patch({ snapDuration: Number(snapDuration) })}
            />
          </TabsContent>
          <TabsContent value="behavior" className="flex flex-col gap-3">
            <SettingsSwitch
              id="ec-set-select-slot"
              label="Click/drag to create"
              checked={settings.interactions.selectSlot}
              onCheckedChange={(selectSlot) =>
                patch({ interactions: { ...settings.interactions, selectSlot } })
              }
            />
            <SettingsSwitch
              id="ec-set-tooltip"
              label="Event tooltips"
              checked={settings.eventTooltip}
              onCheckedChange={(eventTooltip) => patch({ eventTooltip })}
            />
          </TabsContent>
          <TabsContent value="region" className="flex flex-col gap-3">
            <SettingsSelect
              id="ec-set-language"
              label="Language"
              value={settings.localeId}
              options={LOCALES.map((entry) => ({ value: entry.id, label: entry.label }))}
              onValueChange={(localeId) => patch({ localeId })}
            />
            <SettingsSelect
              id="ec-set-timezone"
              label="Time zone"
              value={settings.timeZoneId}
              options={TIME_ZONES.map((entry) => ({ value: entry.id, label: entry.label }))}
              onValueChange={(timeZoneId) => patch({ timeZoneId })}
            />
          </TabsContent>
        </Tabs>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 w-full"
          onClick={() => onChange(DEFAULT_SETTINGS)}
        >
          Reset to defaults
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function CalendarLoadingPanel() {
  return (
    <AppPage>
      <div className="dashboard-panel overflow-hidden rounded-[8px]">
        <CalendarToolbar
          selectedTypes={DEFAULT_FILTERS}
          onToggleType={() => undefined}
          onSelectAll={() => undefined}
        />
        <div className="p-5">
          <Skeleton className="h-[38rem] rounded-[8px]" />
        </div>
      </div>
    </AppPage>
  );
}

export const CalendarView = () => {
  const { tenant } = useTenant();
  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';
  const queryClient = useQueryClient();

  const [selectedTypes, setSelectedTypes] = useState<Record<string, boolean>>(DEFAULT_FILTERS);
  const [addOpen, setAddOpen] = useState(false);
  const [addDialogDate, setAddDialogDate] = useState<string | undefined>();
  const [eventDetails, setEventDetails] = useState<CalendarEventRecord | null>(null);
  const [selectedManualEvent, setSelectedManualEvent] = useState<CalendarEventRecord | null>(null);
  const [eventPendingDeletion, setEventPendingDeletion] = useState<CalendarEventRecord | null>(
    null,
  );
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [settings, setSettings] = useState<CalendarSettings>(DEFAULT_SETTINGS);
  const [view, setView] = useState<ReuiCalendarView>('month');
  const [hasHydrated, setHasHydrated] = useState(() => hasCalendarClientHydrated);
  const { data: events = [], isLoading, isError, error } = useCalendarEvents();

  useEffect(() => {
    hasCalendarClientHydrated = true;
    setHasHydrated(true);
  }, []);

  const isTimeGridView = view !== 'month' && view !== 'agenda';
  const activeLocale = LOCALES.find((entry) => entry.id === settings.localeId) ?? LOCALES[0];
  const activeTimeZone =
    TIME_ZONES.find((entry) => entry.id === settings.timeZoneId) ?? TIME_ZONES[0];

  const filteredEvents = useMemo(
    () => events.filter((event) => selectedTypes[event.type]),
    [events, selectedTypes],
  );

  const reuiEvents = useMemo(
    () => paqadEventsToReui(filteredEvents, { editableManualEvents: isAdmin }),
    [filteredEvents, isAdmin],
  );

  const toggleTypeFilter = (type: string) => {
    setSelectedTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const openAddDialog = (day?: Date) => {
    const target = day ?? new Date();
    setAddDialogDate(formatDateKey(target));
    setAddOpen(true);
  };

  const handleDeleteEvent = async () => {
    if (!eventPendingDeletion) return;

    setIsDeletingEvent(true);
    try {
      await deleteCalendarEvent(eventPendingDeletion.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.calendar.events });
      if (selectedManualEvent?.id === eventPendingDeletion.id) {
        setSelectedManualEvent(null);
      }
      toast.success('Event deleted');
      setEventPendingDeletion(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete event');
    } finally {
      setIsDeletingEvent(false);
    }
  };

  // The event grid derives its initial date and browser time zone at runtime.
  // Keep the server and first browser render identical, then mount the grid
  // after hydration instead of risking a route-wide hydration failure.
  if (!hasHydrated) {
    return <CalendarLoadingPanel />;
  }

  return (
    <AppPage>
      <div className="dashboard-panel overflow-hidden rounded-[8px]">
        <CalendarToolbar
          selectedTypes={selectedTypes}
          onToggleType={toggleTypeFilter}
          onSelectAll={() => setSelectedTypes(DEFAULT_FILTERS)}
          canAddEvent={isAdmin}
        />

        {isLoading ? (
          <div className="p-5">
            <Skeleton className="h-[38rem] rounded-[8px]" />
          </div>
        ) : isError ? (
          <div className="p-5">
            <Alert variant="destructive">
              <AlertTitle>Unable to load calendar</AlertTitle>
              <AlertDescription>
                {error instanceof Error ? error.message : 'Something went wrong'}
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="p-5" dir={activeLocale.dir}>
            <div className="dashboard-soft-tile overflow-hidden rounded-[8px] border border-[#d7e3f6] bg-white/70 dark:border-slate-800 dark:bg-slate-950/50">
              <EventCalendar
                events={reuiEvents}
                defaultView="month"
                onViewChange={setView}
                locale={activeLocale.locale}
                // nested partials are merged over the defaults at runtime
                i18n={activeLocale.i18n as Partial<EventCalendarI18nConfig> | undefined}
                timeZone={activeTimeZone.value}
                viewSettings={settings.viewSettings}
                onViewSettingsChange={(viewSettings) =>
                  setSettings((current) => ({ ...current, viewSettings }))
                }
                interactions={{
                  ...settings.interactions,
                  // Only manually created events become editable for workspace admins.
                  drag: false,
                  resize: false,
                  selectSlot: settings.interactions.selectSlot && isAdmin,
                }}
                weekStartsOn={settings.weekStartsOn}
                dayStartHour={settings.dayStartHour}
                dayEndHour={settings.dayEndHour}
                interval={settings.interval}
                snapDuration={settings.snapDuration}
                eventTooltip={settings.eventTooltip}
                showDayAddButton={settings.showDayAddButton && isAdmin}
                scrollMode="contained"
                className="h-[min(72vh,760px)] min-h-[520px] w-full"
                onSlotClick={(slot) => {
                  if (isAdmin) openAddDialog(slot.date);
                }}
                onSelectSlot={(slot) => {
                  if (isAdmin) openAddDialog(slot.start);
                }}
                onEventClick={() => undefined}
                renderEventTooltip={({ occurrence }) => {
                  const source = (occurrence.event.data as PaqadEventMeta | undefined)?.source;
                  if (!source) return null;

                  const manualEvent = source.manualEvent;
                  return (
                    <div className="min-w-56 space-y-2 text-left">
                      <div className="space-y-0.5">
                        <p className="font-semibold">{source.title}</p>
                        {source.time ? (
                          <p className="text-primary-foreground/80">{source.time}</p>
                        ) : null}
                      </div>
                      {isAdmin && manualEvent ? (
                        <div className="flex flex-wrap items-center gap-2 border-t border-primary-foreground/20 pt-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEventDetails(manualEvent);
                            }}
                          >
                            <Eye className="size-3" aria-hidden="true" />
                            View details
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedManualEvent(manualEvent);
                            }}
                          >
                            <Pencil className="size-3" aria-hidden="true" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEventPendingDeletion(manualEvent);
                            }}
                          >
                            <Trash2 className="size-3" aria-hidden="true" />
                            Delete
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                }}
              >
                <div className="flex flex-wrap items-center gap-2 pe-2">
                  <EventCalendarNav className="min-w-0 flex-1" />
                  <EventCalendarToolbar>
                    <CalendarSettingsPopover
                      settings={settings}
                      onChange={setSettings}
                      isTimeGridView={isTimeGridView}
                    />
                    {isAdmin ? (
                      <Button variant="brandSolid" size="sm" onClick={() => openAddDialog()}>
                        <Plus className="size-4" aria-hidden="true" />
                        Add event
                      </Button>
                    ) : null}
                  </EventCalendarToolbar>
                </div>
                <EventCalendarContent />
              </EventCalendar>
            </div>
          </div>
        )}
      </div>

      <AddCalendarEventDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultDate={addDialogDate}
      />
      <AddCalendarEventDialog
        open={Boolean(selectedManualEvent)}
        onOpenChange={(open) => {
          if (!open) setSelectedManualEvent(null);
        }}
        event={selectedManualEvent}
      />
      <Dialog
        open={Boolean(eventDetails)}
        onOpenChange={(open) => {
          if (!open) setEventDetails(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{eventDetails?.title}</DialogTitle>
            <DialogDescription>
              {eventDetails?.type.replace(/_/g, ' ') ?? 'Calendar event'}
            </DialogDescription>
          </DialogHeader>
          {eventDetails ? (
            <dl className="grid gap-4 text-sm">
              <div className="rounded-[8px] border border-border/70 bg-muted/30 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Date
                </dt>
                <dd className="mt-1 font-medium text-foreground">
                  {formatDate(eventDetails.startDate)}
                  {eventDetails.endDate !== eventDetails.startDate
                    ? ` – ${formatDate(eventDetails.endDate)}`
                    : ''}
                </dd>
              </div>
              <div className="rounded-[8px] border border-border/70 bg-muted/30 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Time
                </dt>
                <dd className="mt-1 font-medium text-foreground">
                  {eventDetails.allDay !== false
                    ? 'All day'
                    : `${eventDetails.startTime?.slice(0, 5) ?? '—'} – ${eventDetails.endTime?.slice(0, 5) ?? '—'}`}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Description
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-foreground">
                  {eventDetails.description || 'No description provided.'}
                </dd>
              </div>
            </dl>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventDetails(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(eventPendingDeletion)}
        onOpenChange={(open) => {
          if (!open && !isDeletingEvent) setEventPendingDeletion(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove “{eventPendingDeletion?.title}” from the calendar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingEvent}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingEvent}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteEvent();
              }}
            >
              {isDeletingEvent ? 'Deleting…' : 'Delete event'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPage>
  );
};
