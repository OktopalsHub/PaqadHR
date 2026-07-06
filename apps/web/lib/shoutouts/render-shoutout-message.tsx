import type { ReactNode } from 'react';
import type { ShoutoutLookupItem } from './parse-shoutout';

const WORD_CHAR = /[\p{L}\p{N}_'-]/u;

function isBoundary(char: string | undefined): boolean {
  return char === undefined || !WORD_CHAR.test(char);
}

function readWord(text: string, start: number): string {
  let end = start;
  while (end < text.length && WORD_CHAR.test(text[end])) end += 1;
  return text.slice(start, end);
}

function matchToken(
  text: string,
  start: number,
  trigger: '@' | '#',
  items: ShoutoutLookupItem[],
): { text: string; length: number } | null {
  const lowerRest = text.slice(start).toLowerCase();
  let best: { text: string; length: number } | null = null;

  for (const item of items) {
    const name = item.name.trim();
    const lowerName = name.toLowerCase();
    if (!lowerName) continue;
    if (lowerRest.startsWith(lowerName) && isBoundary(text[start + lowerName.length])) {
      if (!best || lowerName.length > best.length) {
        best = { text: name, length: lowerName.length };
      }
    }
  }
  if (best) return best;

  const word = readWord(text, start);
  if (!word) return null;
  const lowerWord = word.toLowerCase();
  const firstNameMatches = items.filter(
    (item) => item.name.trim().split(/\s+/)[0]?.toLowerCase() === lowerWord,
  );
  if (firstNameMatches.length === 1) {
    return { text: word, length: word.length };
  }
  if (trigger === '@' || trigger === '#') {
    return { text: word, length: word.length };
  }
  return null;
}

type RenderOptions = {
  employees?: ShoutoutLookupItem[];
  categories?: ShoutoutLookupItem[];
};

export function renderShoutoutMessage(message: string, options: RenderOptions = {}): ReactNode[] {
  const employees = options.employees ?? [];
  const categories = options.categories ?? [];
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < message.length) {
    const char = message[i];

    if (char === '@' && isBoundary(message[i - 1])) {
      const match = matchToken(message, i + 1, '@', employees);
      if (match) {
        nodes.push(
          <span key={key++} className="font-medium text-sky-600 dark:text-sky-400">
            @{match.text}
          </span>,
        );
        i += 1 + match.length;
        continue;
      }
    }

    if (char === '#' && isBoundary(message[i - 1])) {
      const match = matchToken(message, i + 1, '#', categories);
      if (match) {
        nodes.push(
          <span key={key++} className="font-medium text-indigo-600 dark:text-indigo-400">
            #{match.text}
          </span>,
        );
        i += 1 + match.length;
        continue;
      }
    }

    if (char === '+' && isBoundary(message[i - 1])) {
      let end = i + 1;
      while (end < message.length && /\d/.test(message[end])) end += 1;
      if (end > i + 1) {
        nodes.push(
          <span key={key++} className="font-mono font-medium text-amber-600 dark:text-amber-400">
            {message.slice(i, end)}
          </span>,
        );
        i = end;
        continue;
      }
    }

    const nextSpecial = (() => {
      for (let j = i + 1; j < message.length; j += 1) {
        const c = message[j];
        if ((c === '@' || c === '#' || c === '+') && isBoundary(message[j - 1])) return j;
      }
      return message.length;
    })();

    nodes.push(<span key={key++}>{message.slice(i, nextSpecial)}</span>);
    i = nextSpecial;
  }

  return nodes;
}
