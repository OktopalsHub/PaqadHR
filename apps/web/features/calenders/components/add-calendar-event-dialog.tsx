'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  type EventSpanMode,
  REMINDER_OPTIONS,
  todayDateKey,
} from '@/features/calenders/lib/calendar-event-form';
import { createCalendarEvent } from '@/lib/api/calendar-events';
import { queryKeys } from '@/lib/query/keys';

type AddCalendarEventDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
};

const DEFAULT_START_TIME = '09:00';
const DEFAULT_END_TIME = '10:00';

export function AddCalendarEventDialog({
  open,
  onOpenChange,
  defaultDate,
}: AddCalendarEventDialogProps) {
  const queryClient = useQueryClient();
  const [spanMode, setSpanMode] = useState<EventSpanMode>('single');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState(DEFAULT_START_TIME);
  const [endTime, setEndTime] = useState(DEFAULT_END_TIME);
  const [reminder, setReminder] = useState('none');
  const [type, setType] = useState('meeting');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const date = defaultDate ?? todayDateKey();
    setSpanMode('single');
    setTitle('');
    setDescription('');
    setStartDate(date);
    setEndDate(date);
    setAllDay(true);
    setStartTime(DEFAULT_START_TIME);
    setEndTime(DEFAULT_END_TIME);
    setReminder('none');
    setType('meeting');
  }, [open, defaultDate]);

  const handleSpanModeChange = (value: string) => {
    if (value !== 'single' && value !== 'range') return;
    setSpanMode(value);
    if (value === 'single') {
      setEndDate(startDate);
      setAllDay(true);
    } else {
      setAllDay(true);
      if (!endDate || endDate < startDate) {
        setEndDate(startDate);
      }
    }
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (spanMode === 'single') {
      setEndDate(value);
    } else if (endDate < value) {
      setEndDate(value);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !startDate || !endDate) {
      toast.error('Title and date are required');
      return;
    }
    if (endDate < startDate) {
      toast.error('End date cannot be before start date');
      return;
    }
    if (!allDay && spanMode === 'single') {
      if (!startTime || !endTime) {
        toast.error('Start and end times are required');
        return;
      }
      if (endTime <= startTime) {
        toast.error('End time must be after start time');
        return;
      }
    }

    const reminderOption = REMINDER_OPTIONS.find((item) => item.value === reminder);

    setBusy(true);
    try {
      await createCalendarEvent({
        title: title.trim(),
        description: description.trim() || undefined,
        startDate,
        endDate,
        allDay: spanMode === 'range' ? true : allDay,
        startTime: !allDay && spanMode === 'single' ? startTime : undefined,
        endTime: !allDay && spanMode === 'single' ? endTime : undefined,
        reminderMinutes: reminderOption?.minutes ?? null,
        type,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.calendar.events });
      toast.success(spanMode === 'single' ? 'Event added for this day' : 'Multi-day event added');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add event');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add calendar event</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Event type</Label>
            <ToggleGroup
              type="single"
              value={spanMode}
              onValueChange={handleSpanModeChange}
              className="grid w-full grid-cols-2"
            >
              <ToggleGroupItem value="single" className="text-xs sm:text-sm">
                Single day
              </ToggleGroupItem>
              <ToggleGroupItem value="range" className="text-xs sm:text-sm">
                Date range
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Team standup, offsite, etc."
            />
          </div>

          {spanMode === 'single' ? (
            <div className="space-y-2">
              <Label htmlFor="event-date">Date</Label>
              <Input
                id="event-date"
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event-start-date">From</Label>
                <Input
                  id="event-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-end-date">To</Label>
                <Input
                  id="event-end-date"
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {spanMode === 'single' ? (
            <div className="space-y-3 rounded-lg border border-border/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="all-day">All day</Label>
                </div>
                <Switch id="all-day" checked={allDay} onCheckedChange={setAllDay} />
              </div>
              {!allDay ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="start-time">Start time</Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-time">End time</Label>
                    <Input
                      id="end-time"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="all_hands">All hands</SelectItem>
                  <SelectItem value="reminder">Reminder</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reminder</Label>
              <Select value={reminder} onValueChange={setReminder}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-description">Description</Label>
            <Textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional notes for the team"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={handleSubmit}>
            {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Save event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
