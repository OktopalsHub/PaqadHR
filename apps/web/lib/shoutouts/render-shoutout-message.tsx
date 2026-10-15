import type { ReactNode } from 'react';
import { MentionChip } from './mention-chip';
import type { ShoutoutLookupItem } from './parse-shoutout';
import { tokenizeShoutoutMessage } from './shoutout-message-tokens';

const EMOJI_SEQUENCE_REGEX = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]+/u;

type RenderOptions = {
  employees?: ShoutoutLookupItem[];
  categories?: ShoutoutLookupItem[];
};

export function renderShoutoutMessage(message: string, options: RenderOptions = {}): ReactNode[] {
  const tokens = tokenizeShoutoutMessage(
    message,
    options.employees ?? [],
    options.categories ?? [],
  );
  const nodes: ReactNode[] = [];
  let key = 0;

  for (const token of tokens) {
    if (token.type === 'mention') {
      nodes.push(<MentionChip key={key++} memberId={token.id} label={`@${token.text}`} />);
      continue;
    }

    if (token.type === 'category') {
      nodes.push(
        <span key={key++} className="font-medium text-indigo-600 dark:text-indigo-400">
          #{token.text}
        </span>,
      );
      continue;
    }

    if (token.type === 'points') {
      nodes.push(
        <span key={key++} className="font-mono font-medium text-amber-600 dark:text-amber-400">
          {token.text}
        </span>,
      );
      continue;
    }

    // Handle emojis with proper sizing using sequence matching
    let lastIndex = 0;
    const emojiRegex = new RegExp(EMOJI_SEQUENCE_REGEX);
    let match: RegExpExecArray | null = emojiRegex.exec(token.text);

    while (match !== null) {
      const emojiText = match[0];
      const emojiStart = lastIndex + match.index;

      if (emojiStart > lastIndex) {
        nodes.push(<span key={key++}>{token.text.slice(lastIndex, emojiStart)}</span>);
      }

      nodes.push(
        <span
          key={key++}
          className="inline-flex items-center justify-center"
          style={{ fontSize: '1.25em', lineHeight: '1' }}
        >
          {emojiText}
        </span>,
      );

      lastIndex = emojiStart + emojiText.length;
      emojiRegex.lastIndex = 0; // Reset regex for next match
      match = emojiRegex.exec(token.text.slice(lastIndex));
    }

    // Remaining text after the last emoji (also covers emoji-free segments)
    if (lastIndex < token.text.length) {
      nodes.push(<span key={key++}>{token.text.slice(lastIndex)}</span>);
    }
  }

  return nodes;
}
