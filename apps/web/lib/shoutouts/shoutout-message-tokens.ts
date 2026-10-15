import type { ShoutoutLookupItem } from './parse-shoutout';

const WORD_CHAR = /[\p{L}\p{N}_'-]/u;

export type ShoutoutMessageToken =
  | { type: 'mention'; text: string; id?: string }
  | { type: 'category'; text: string; id?: string }
  | { type: 'points'; text: string }
  | { type: 'text'; text: string };

function isBoundary(char: string | undefined): boolean {
  return char === undefined || !WORD_CHAR.test(char);
}

function readWord(text: string, start: number): string {
  let end = start;
  while (end < text.length && WORD_CHAR.test(text[end])) end += 1;
  return text.slice(start, end);
}

/**
 * Matches the longest lookup item whose name appears at `start`
 * (case-insensitive, followed by a word boundary). Falls back to a single
 * word only when it uniquely matches an item's first name ("@Dan" → "Dan
 * Smith"). Returns null when nothing matches so callers can render the raw
 * word as plain text.
 */
function matchToken(
  text: string,
  start: number,
  items: ShoutoutLookupItem[],
): { item: ShoutoutLookupItem; text: string; length: number } | null {
  const lowerRest = text.slice(start).toLowerCase();

  let best: { item: ShoutoutLookupItem; text: string; length: number } | null = null;
  for (const item of items) {
    const name = item.name.trim();
    const lowerName = name.toLowerCase();
    if (!lowerName) continue;
    if (lowerRest.startsWith(lowerName) && isBoundary(text[start + lowerName.length])) {
      if (!best || lowerName.length > best.length) {
        best = { item, text: name, length: lowerName.length };
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
    return {
      item: firstNameMatches[0],
      text: firstNameMatches[0].name.trim(),
      length: word.length,
    };
  }
  return null;
}

/**
 * Splits a shoutout message into render tokens for `@mentions`,
 * `#categories`, `+points`, and plain text. Triggers are only recognized at
 * token boundaries so emails and URLs pass through as text. Names that don't
 * resolve to a known member/category stay as plain text.
 */
export function tokenizeShoutoutMessage(
  message: string,
  employees: ShoutoutLookupItem[] = [],
  categories: ShoutoutLookupItem[] = [],
): ShoutoutMessageToken[] {
  const tokens: ShoutoutMessageToken[] = [];
  let i = 0;

  while (i < message.length) {
    const char = message[i];

    if (char === '@' && isBoundary(message[i - 1])) {
      const match = matchToken(message, i + 1, employees);
      if (match) {
        tokens.push({ type: 'mention', text: match.text, id: match.item.id });
        i += 1 + match.length;
        continue;
      }
    }

    if (char === '#' && isBoundary(message[i - 1])) {
      const match = matchToken(message, i + 1, categories);
      if (match) {
        tokens.push({ type: 'category', text: match.text, id: match.item.id });
        i += 1 + match.length;
        continue;
      }
    }

    if (char === '+' && /\d/.test(message[i + 1] ?? '')) {
      let end = i + 1;
      while (end < message.length && /\d/.test(message[end])) end += 1;
      tokens.push({ type: 'points', text: message.slice(i, end) });
      i = end;
      continue;
    }

    let nextSpecial = message.length;
    for (let j = i + 1; j < message.length; j += 1) {
      const c = message[j];
      if ((c === '@' || c === '#' || c === '+') && isBoundary(message[j - 1])) {
        nextSpecial = j;
        break;
      }
    }
    const segment = message.slice(i, nextSpecial);
    if (segment) tokens.push({ type: 'text', text: segment });
    i = nextSpecial;
  }

  return tokens;
}
