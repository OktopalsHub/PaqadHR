'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Award,
  Check,
  Coins,
  Film,
  Image as ImageIcon,
  Loader2,
  Plus,
  Send,
  Smile,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PAQ_POINTS_NAME } from '@/lib/constants/paq-points';
import type { MemberPointsBalance } from '@/lib/schemas/member-points';
import type { ShoutoutCategory } from '@/lib/schemas/shoutout';
import { cn } from '@/lib/utils';

type EmployeeOption = { id: string; name: string };

type ShoutoutComposerProps = {
  employees: EmployeeOption[];
  categories: ShoutoutCategory[];
  points?: MemberPointsBalance;
  recipientIds: string[];
  onRecipientChange: (value: string[]) => void;
  categoryId: string;
  onCategoryChange: (value: string) => void;
  pointsValue: string;
  onPointsChange: (value: string) => void;
  message: string;
  onMessageChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  disabled?: boolean;
  disabledHint?: string;
  slackStatusLine?: string;
  variant?: 'panel' | 'feed';
  className?: string;
};

const EMOJIS = ['🙌', '🚀', '⭐', '❤️', '👏', '🎉', '🔥', '💪', '💡', '🌟'];

const MOCK_GIFS = [
  { id: '1', url: 'https://media.giphy.com/media/l3q2XhfQ8oCkm1K76/giphy.gif', title: 'Clapping' },
  {
    id: '2',
    url: 'https://media.giphy.com/media/3oz8xAFtqo0qyTZRZS/giphy.gif',
    title: 'High Five',
  },
  {
    id: '3',
    url: 'https://media.giphy.com/media/5GovlcmKGl6U55JHdh/giphy.gif',
    title: 'Minions Yay',
  },
  { id: '4', url: 'https://media.giphy.com/media/11sBLVxNs7v6WA/giphy.gif', title: 'Great Job' },
  {
    id: '5',
    url: 'https://media.giphy.com/media/NEvPzZ8bd1V4Y/giphy.gif',
    title: 'Nodding Approval',
  },
  { id: '6', url: 'https://media.giphy.com/media/c51u3TvA5PfOM/giphy.gif', title: 'Golden Buzzer' },
];

export function ShoutoutComposer({
  employees,
  categories,
  points,
  recipientIds,
  onRecipientChange,
  categoryId,
  onCategoryChange,
  pointsValue,
  onPointsChange,
  message,
  onMessageChange,
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

  const [recipientOpen, setRecipientOpen] = useState(false);
  const [valueOpen, setValueOpen] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);

  const [attachedGif, setAttachedGif] = useState<string | null>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);

  const selectedRecipients = employees.filter((e) => recipientIds.includes(e.id));
  const selectedCategory = categories.find((c) => c.id === categoryId);

  const handleQuickPoints = (val: number) => {
    onPointsChange(String(Math.min(val, allowance)));
    setPointsOpen(false);
  };

  const insertEmoji = (emoji: string) => {
    onMessageChange(message + emoji);
    setEmojiOpen(false);
  };

  const handleGifSelect = (gifUrl: string) => {
    setAttachedGif(gifUrl);
    setAttachedImage(null); // Clear other media
    setGifOpen(false);
  };

  const handleImageMockUpload = () => {
    setAttachedImage(
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80',
    );
    setAttachedGif(null); // Clear other media
    toast.success('Mock image attached!');
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/20',
        className,
      )}
    >
      <div className="flex items-center gap-3 pb-3 border-b border-border/50">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/20 text-primary shadow-sm">
          <Sparkles className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Celebrate your team</h3>
          <p className="text-xs text-muted-foreground">
            Give shoutouts, share recognition, and award points
          </p>
        </div>
        {points ? (
          <div className="text-right">
            <Badge
              variant="outline"
              className="px-2.5 py-0.5 font-medium border-primary/20 bg-primary/5 text-primary"
            >
              {allowance.toLocaleString()} {PAQ_POINTS_NAME} left
            </Badge>
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        {}
        <div className="relative rounded-xl border border-border/60 bg-muted/20 p-3 transition-all focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
          <textarea
            className="w-full min-h-[90px] bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground/80"
            placeholder="Write a message to appreciate someone... Use buttons below to add teammate, value, and points!"
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
          />

          {}
          <AnimatePresence>
            {(attachedGif || attachedImage) && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative mt-2 max-w-[200px] overflow-hidden rounded-lg border bg-background"
              >
                {/* biome-ignore lint/performance/noImgElement: user attachment preview URL */}
                <img
                  src={attachedGif || attachedImage || ''}
                  alt="Attachment"
                  className="aspect-video w-full object-cover"
                />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute right-1 top-1 size-6 rounded-full"
                  onClick={() => {
                    setAttachedGif(null);
                    setAttachedImage(null);
                  }}
                >
                  <X className="size-3.5" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {}
        <div className="flex flex-wrap gap-1.5 min-h-[24px]">
          {selectedRecipients.map((recipient) => (
            <Badge
              key={recipient.id}
              variant="secondary"
              className="flex items-center gap-1 bg-sky-500/10 text-sky-600 hover:bg-sky-500/15 border-sky-100"
            >
              <User className="size-3" />
              To: {recipient.name}
              <X
                className="size-3 cursor-pointer ml-1"
                onClick={() => onRecipientChange(recipientIds.filter((id) => id !== recipient.id))}
              />
            </Badge>
          ))}

          {selectedCategory && (
            <Badge
              variant="secondary"
              className="flex items-center gap-1 bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/15 border-indigo-100"
            >
              <Award className="size-3" />
              {selectedCategory.name}
              <X className="size-3 cursor-pointer ml-1" onClick={() => onCategoryChange('')} />
            </Badge>
          )}

          {Number(pointsValue) > 0 && (
            <Badge
              variant="secondary"
              className="flex items-center gap-1 bg-amber-500/10 text-amber-600 hover:bg-amber-500/15 border-amber-100 font-mono"
            >
              <Coins className="size-3" />+{pointsValue} {PAQ_POINTS_NAME}
              <X className="size-3 cursor-pointer ml-1" onClick={() => onPointsChange('0')} />
            </Badge>
          )}
        </div>

        {}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {}
            <Popover open={recipientOpen} onOpenChange={setRecipientOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 hover:bg-muted/80"
                  title="Select teammate(s)"
                >
                  <User className="size-4 text-sky-500" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search teammate..." />
                  <CommandList>
                    <CommandEmpty>No teammate found</CommandEmpty>
                    <CommandGroup>
                      {employees.map((employee) => {
                        const isSelected = recipientIds.includes(employee.id);
                        return (
                          <CommandItem
                            key={employee.id}
                            value={employee.name}
                            onSelect={() => {
                              if (isSelected) {
                                onRecipientChange(recipientIds.filter((id) => id !== employee.id));
                              } else {
                                onRecipientChange([...recipientIds, employee.id]);
                              }
                            }}
                            className="flex items-center justify-between cursor-pointer"
                          >
                            <span>{employee.name}</span>
                            {isSelected && <Check className="size-4 text-primary" />}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {}
            {categories.length > 0 && (
              <Popover open={valueOpen} onOpenChange={setValueOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 gap-1.5 hover:bg-muted/80"
                  >
                    <Award className="size-4 text-indigo-500" />
                    <span className="hidden sm:inline">Core Value</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60 p-2" align="start">
                  <p className="text-xs font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
                    Core Company Values
                  </p>
                  <div className="mt-1 flex flex-col gap-1">
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => {
                          onCategoryChange(category.id);
                          setValueOpen(false);
                        }}
                        className={cn(
                          'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted',
                          categoryId === category.id && 'bg-primary/5 text-primary font-medium',
                        )}
                      >
                        <span>{category.name}</span>
                        {categoryId === category.id && <Check className="size-3.5" />}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {}
            <Popover open={pointsOpen} onOpenChange={setPointsOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 gap-1.5 hover:bg-muted/80 font-mono"
                >
                  <Coins className="size-4 text-amber-500" />
                  <span className="hidden sm:inline">Points</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3 space-y-3" align="start">
                <div className="space-y-1">
                  <Label className="text-xs">Give {PAQ_POINTS_NAME}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={allowance}
                      value={pointsValue}
                      onChange={(e) => onPointsChange(e.target.value)}
                      className="h-8 font-mono"
                    />
                    <span className="text-xs text-muted-foreground">pts</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Quick Select
                  </Label>
                  <div className="grid grid-cols-4 gap-1">
                    {[5, 10, 20, 50].map((val) => (
                      <Button
                        key={val}
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs font-mono p-0"
                        onClick={() => handleQuickPoints(val)}
                      >
                        +{val}
                      </Button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {}
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 hover:bg-muted/80">
                  <Smile className="size-4 text-pink-500" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start">
                <div className="grid grid-cols-5 gap-1">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="flex size-8 items-center justify-center rounded text-lg transition-transform hover:scale-125 hover:bg-muted"
                      onClick={() => insertEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {}
            <Popover open={gifOpen} onOpenChange={setGifOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 hover:bg-muted/80">
                  <Film className="size-4 text-teal-500" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 space-y-2" align="start">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Add GIF
                </p>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {MOCK_GIFS.map((gif) => (
                    <button
                      key={gif.id}
                      type="button"
                      className="group relative overflow-hidden rounded border bg-muted aspect-video"
                      onClick={() => handleGifSelect(gif.url)}
                    >
                      {/* biome-ignore lint/performance/noImgElement: external GIF picker thumbnail */}
                      <img src={gif.url} alt={gif.title} className="size-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus className="size-5 text-white" />
                      </div>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {}
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 hover:bg-muted/80"
              onClick={handleImageMockUpload}
            >
              <ImageIcon className="size-4 text-rose-500" />
            </Button>
          </div>

          <Button
            size="sm"
            className="h-9 px-4 gap-1.5 font-medium shadow-sm transition-all active:scale-95"
            disabled={isSubmitting || disabled || recipientIds.length === 0 || !message.trim()}
            onClick={onSubmit}
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
        <p className="mt-3 rounded-lg border border-dashed border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {disabledHint}
        </p>
      ) : null}

      {isFeed && slackStatusLine ? (
        <p className="mt-3 text-[10px] text-muted-foreground">{slackStatusLine}</p>
      ) : null}
    </div>
  );
}

import { toast } from 'sonner';
