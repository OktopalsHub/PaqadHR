'use client';

import { AtSign, Coins, Hash, Loader2, Send, Smile, Sparkles, User, X } from 'lucide-react';
import { type ChangeEvent, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PAQ_POINTS_NAME } from '@/lib/constants/paq-points';
import type { MemberPointsBalance } from '@/lib/schemas/member-points';
import type { ShoutoutCategory } from '@/lib/schemas/shoutout';
import { parseShoutout } from '@/lib/shoutouts/parse-shoutout';
import { cn } from '@/lib/utils';

type EmployeeOption = { id: string; name: string };

export type ShoutoutSubmitPayload = {
  message: string;
  recipients: { recipientId: string; points: number }[];
  categoryIds: string[];
};

type ShoutoutComposerProps = {
  employees: EmployeeOption[];
  categories: ShoutoutCategory[];
  points?: MemberPointsBalance;
  onSubmit: (payload: ShoutoutSubmitPayload) => Promise<void>;
  isSubmitting: boolean;
  disabled?: boolean;
  disabledHint?: string;
  slackStatusLine?: string;
  variant?: 'panel' | 'feed';
  className?: string;
};

const EMOJIS = ['🙌', '🚀', '⭐', '❤️', '👏', '🎉', '🔥', '💪', '💡', '🌟'];
const WORD_CHAR = /[\p{L}\p{N}_'-]/u;

type ActiveToken = { type: '@' | '#'; query: string; start: number };

function findActiveToken(value: string, caret: number): ActiveToken | null {
  let i = caret - 1;
  while (i >= 0 && WORD_CHAR.test(value[i])) i -= 1;
  const trigger = value[i];
  if (trigger !== '@' && trigger !== '#') return null;
  if (i > 0 && WORD_CHAR.test(value[i - 1])) return null;
  return { type: trigger, query: value.slice(i + 1, caret), start: i };
}

export function ShoutoutComposer({
  employees,
  categories,
  points,
  onSubmit,
  isSubmitting,
  disabled = false,
  disabledHint,
  slackStatusLine,
  variant = 'panel',
  className,
}: ShoutoutComposerProps) {
  const allowance = points?.remainingAllowance ?? 100;
  const isFeed = variant === 'feed';

  const [message, setMessage] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [active, setActive] = useState<ActiveToken | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const employeeLookup = useMemo(
    () => employees.map((employee) => ({ id: employee.id, name: employee.name })),
    [employees],
  );
  const categoryLookup = useMemo(
    () => categories.map((category) => ({ id: category.id, name: category.name })),
    [categories],
  );

  const parsed = useMemo(
    () => parseShoutout(message, employeeLookup, categoryLookup),
    [message, employeeLookup, categoryLookup],
  );

  const suggestions = useMemo(() => {
    if (!active) return [];
    const source = active.type === '@' ? employees : categories;
    const query = active.query.toLowerCase();
    return source.filter((item) => item.name.toLowerCase().includes(query)).slice(0, 6);
  }, [active, employees, categories]);

  const zeroPointRecipients = parsed.recipients.filter((recipient) => recipient.points < 1);
  const overAllowance = parsed.totalPoints > allowance;
  const canSubmit =
    !disabled &&
    !isSubmitting &&
    message.trim().length > 0 &&
    parsed.recipients.length > 0 &&
    zeroPointRecipients.length === 0 &&
    parsed.unknownMentions.length === 0 &&
    !overAllowance;

  const syncActive = (value: string, caret: number) => {
    setActive(findActiveToken(value, caret));
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setMessage(value);
    syncActive(value, event.target.selectionStart ?? value.length);
  };

  const applySuggestion = (name: string) => {
    if (!active) return;
    const before = message.slice(0, active.start);
    const after = message.slice(active.start + 1 + active.query.length);
    const insert = `${active.type}${name} `;
    const next = `${before}${insert}${after}`;
    setMessage(next);
    setActive(null);

    requestAnimationFrame(() => {
      const element = textareaRef.current;
      if (!element) return;
      const pos = before.length + insert.length;
      element.focus();
      element.setSelectionRange(pos, pos);
    });
  };

  const insertTrigger = (trigger: '@' | '#') => {
    const element = textareaRef.current;
    const caret = element?.selectionStart ?? message.length;
    const needsSpace = caret > 0 && message[caret - 1] && !/\s/.test(message[caret - 1]);
    const insert = `${needsSpace ? ' ' : ''}${trigger}`;
    const next = `${message.slice(0, caret)}${insert}${message.slice(caret)}`;
    setMessage(next);

    requestAnimationFrame(() => {
      if (!element) return;
      const pos = caret + insert.length;
      element.focus();
      element.setSelectionRange(pos, pos);
      syncActive(next, pos);
    });
  };

  const insertEmoji = (emoji: string) => {
    const element = textareaRef.current;
    const caret = element?.selectionStart ?? message.length;
    setMessage(`${message.slice(0, caret)}${emoji}${message.slice(caret)}`);
    setEmojiOpen(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    try {
      await onSubmit({
        message: message.trim(),
        recipients: parsed.recipients.map((recipient) => ({
          recipientId: recipient.recipientId,
          points: recipient.points,
        })),
        categoryIds: parsed.categoryIds,
      });
      setMessage('');
      setActive(null);
      setEmojiOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send shoutout');
    }
  };

  return (
    <div
      className={cn(
        'app-card relative overflow-hidden rounded-[8px] p-5 transition-all duration-300 hover:border-primary/20',
        isFeed ? 'shadow-sm' : undefined,
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-[#dce9e3] pb-3 dark:border-slate-700">
        <div className="flex size-10 items-center justify-center rounded-[8px] bg-gradient-to-br from-primary/10 to-primary/20 text-primary shadow-sm">
          <Sparkles className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">
            Celebrate your team
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Mention teammates with <span className="font-mono">@</span>, tag values with{' '}
            <span className="font-mono">#</span>, and assign points with{' '}
            <span className="font-mono">+10</span>.
          </p>
        </div>
        {points ? (
          <Badge
            variant="outline"
            className="border-primary/20 bg-primary/5 px-2.5 py-0.5 font-medium text-primary"
          >
            {allowance.toLocaleString()} {PAQ_POINTS_NAME} left
          </Badge>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        <div className="relative rounded-[8px] border border-[#dce9e3] bg-white/75 p-3 transition-all focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/15 dark:border-slate-800 dark:bg-slate-950/45">
          <textarea
            ref={textareaRef}
            className="min-h-[90px] w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/80"
            placeholder="e.g. @Dan +20 @Prisca +10 amazing work on the launch #Excellence"
            value={message}
            onChange={handleChange}
            onKeyUp={(event) =>
              syncActive(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)
            }
            onClick={(event) =>
              syncActive(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)
            }
            onBlur={() => setTimeout(() => setActive(null), 150)}
          />

          {active && suggestions.length > 0 ? (
            <div className="absolute left-3 right-3 top-full z-20 mt-1 overflow-hidden rounded-[8px] border border-[#dce9e3] bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-900"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applySuggestion(item.name);
                  }}
                >
                  {active.type === '@' ? (
                    <User className="size-3.5 text-sky-500" />
                  ) : (
                    <Hash className="size-3.5 text-indigo-500" />
                  )}
                  {item.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {parsed.recipients.length > 0 || parsed.categoryNames.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {parsed.recipients.map((recipient) => (
              <Badge
                key={recipient.occurrenceKey}
                variant="secondary"
                className={cn(
                  'flex items-center gap-1 border-sky-100 bg-sky-500/10 text-sky-600',
                  recipient.points < 1 && 'border-amber-200 bg-amber-500/10 text-amber-600',
                )}
              >
                <User className="size-3" />
                {recipient.name}
                <span className="font-mono">+{recipient.points}</span>
              </Badge>
            ))}
            {parsed.categoryNames.map((name) => (
              <Badge
                key={name}
                variant="secondary"
                className="flex items-center gap-1 border-indigo-100 bg-indigo-500/10 text-indigo-600"
              >
                <Hash className="size-3" />
                {name}
              </Badge>
            ))}
            {parsed.totalPoints > 0 ? (
              <Badge
                variant="secondary"
                className="flex items-center gap-1 border-amber-100 bg-amber-500/10 font-mono text-amber-600"
              >
                <Coins className="size-3" />
                {parsed.totalPoints} total
              </Badge>
            ) : null}
          </div>
        ) : null}

        {parsed.unknownMentions.length > 0 ? (
          <p className="rounded-lg border border-dashed border-amber-300/60 bg-amber-500/5 px-3 py-2 text-xs text-amber-600">
            No teammate found for: {parsed.unknownMentions.map((name) => `@${name}`).join(', ')}
          </p>
        ) : null}

        {parsed.unknownCategories.length > 0 ? (
          <p className="rounded-lg border border-dashed border-indigo-300/60 bg-indigo-500/5 px-3 py-2 text-xs text-indigo-600 dark:text-indigo-300">
            No core value found for: {parsed.unknownCategories.map((name) => `#${name}`).join(', ')}
          </p>
        ) : null}

        {zeroPointRecipients.length > 0 ? (
          <p className="rounded-lg border border-dashed border-amber-300/60 bg-amber-500/5 px-3 py-2 text-xs text-amber-600">
            Add points for {zeroPointRecipients.map((recipient) => `@${recipient.name}`).join(', ')}{' '}
            <span className="font-mono">e.g. @{zeroPointRecipients[0].name} +10</span>
          </p>
        ) : null}

        {overAllowance ? (
          <p className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            That&apos;s {parsed.totalPoints} points but you only have {allowance} left this period.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="size-9 hover:bg-muted/80"
              title="Mention a teammate"
              onClick={() => insertTrigger('@')}
            >
              <AtSign className="size-4 text-sky-500" />
            </Button>

            {categories.length > 0 ? (
              <Button
                variant="outline"
                size="icon"
                className="size-9 hover:bg-muted/80"
                title="Tag a core value"
                onClick={() => insertTrigger('#')}
              >
                <Hash className="size-4 text-indigo-500" />
              </Button>
            ) : null}

            <div className="relative">
              <Button
                variant="outline"
                size="icon"
                className="size-9 hover:bg-muted/80"
                onClick={() => setEmojiOpen((open) => !open)}
              >
                <Smile className="size-4 text-pink-500" />
              </Button>
              {emojiOpen ? (
                <div className="absolute left-0 top-full z-20 mt-1 grid grid-cols-5 gap-1 rounded-[8px] border border-[#dce9e3] bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-950">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="flex size-8 items-center justify-center rounded text-lg transition-transform hover:scale-125 hover:bg-slate-100 dark:hover:bg-slate-900"
                      onClick={() => insertEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <Button
            variant="default"
            size="sm"
            className="h-9 gap-1.5 px-4 font-medium shadow-sm transition-all active:scale-95"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Send
          </Button>
        </div>
      </div>

      {disabled && disabledHint ? (
        <p className="mt-3 flex items-center gap-1.5 rounded-[8px] border border-dashed border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <X className="size-3" />
          {disabledHint}
        </p>
      ) : null}

      {isFeed && slackStatusLine ? (
        <p className="mt-3 text-[10px] text-muted-foreground">{slackStatusLine}</p>
      ) : null}
    </div>
  );
}
