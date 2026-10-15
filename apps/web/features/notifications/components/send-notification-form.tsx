'use client';

import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { useBroadcastNotification } from '@/hooks/queries/use-notifications';

const TITLE_MAX = 120;
const MESSAGE_MAX = 2000;

export function SendNotificationForm({ onBack }: { onBack: () => void }) {
  const broadcast = useBroadcastNotification();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [alsoEmail, setAlsoEmail] = useState(false);

  const canSubmit = title.trim().length > 0 && message.trim().length > 0 && !broadcast.isPending;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    try {
      const result = await broadcast.mutateAsync({
        title: title.trim(),
        message: message.trim(),
        priority,
        channel: alsoEmail ? 'both' : 'in_app',
      });
      toast.success(`Notification sent to ${result.recipients} member(s)`);
      setTitle('');
      setMessage('');
      setPriority('medium');
      setAlsoEmail(false);
      onBack();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to send notification. Try again.',
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-fit gap-1 px-2 text-xs text-muted-foreground"
        onClick={onBack}
      >
        <ArrowLeft className="size-3.5" />
        Back to notifications
      </Button>

      <div className="flex flex-col gap-2">
        <Label htmlFor="broadcast-title">Title</Label>
        <Input
          id="broadcast-title"
          value={title}
          maxLength={TITLE_MAX}
          placeholder="e.g. Office closed on Friday"
          onChange={(event) => setTitle(event.target.value)}
        />
        <p className="text-right text-[10px] text-muted-foreground">
          {title.length}/{TITLE_MAX}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="broadcast-message">Message</Label>
        <Textarea
          id="broadcast-message"
          value={message}
          maxLength={MESSAGE_MAX}
          rows={6}
          placeholder="Write the announcement for your team…"
          onChange={(event) => setMessage(event.target.value)}
        />
        <p className="text-right text-[10px] text-muted-foreground">
          {message.length}/{MESSAGE_MAX}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Priority</Label>
        <Select value={priority} onValueChange={(value) => setPriority(value as typeof priority)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="broadcast-email" className="text-sm">
            Also send by email
          </Label>
          <p className="text-xs text-muted-foreground">
            Delivers this announcement to each member&apos;s inbox as well.
          </p>
        </div>
        <Switch id="broadcast-email" checked={alsoEmail} onCheckedChange={setAlsoEmail} />
      </div>

      <Button type="submit" disabled={!canSubmit} className="mt-auto w-full">
        {broadcast.isPending ? 'Sending…' : 'Send to all members'}
      </Button>
    </form>
  );
}
