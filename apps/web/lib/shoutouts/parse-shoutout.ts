export interface ShoutoutLookupItem {
  id: string;
  name: string;
}

export interface ParsedRecipient {
  recipientId: string;
  name: string;
  points: number;
}

export interface ParsedShoutout {
  recipients: ParsedRecipient[];
  categoryIds: string[];
  categoryNames: string[];
  unknownMentions: string[];
  unknownCategories: string[];
  totalPoints: number;
}

const WORD_CHAR = /[\p{L}\p{N}_'-]/u;

function isBoundary(char: string | undefined): boolean {
  return char === undefined || !WORD_CHAR.test(char);
}

function readWord(text: string, start: number): string {
  let end = start;
  while (end < text.length && WORD_CHAR.test(text[end])) end += 1;
  return text.slice(start, end);
}

/**
 * Matches the longest lookup item whose name appears at `start` (case-insensitive)
 * followed by a word boundary. Falls back to matching a single following word
 * against each item's first name when the full display name isn't spelled out
 * (e.g. "@Dan" resolving to "Dan Smith"), but only when that first-name match is
 * unambiguous.
 */
function matchAt(
  text: string,
  start: number,
  items: ShoutoutLookupItem[],
): { item: ShoutoutLookupItem; length: number } | null {
  const lowerRest = text.slice(start).toLowerCase();

  let best: { item: ShoutoutLookupItem; length: number } | null = null;
  for (const item of items) {
    const name = item.name.trim().toLowerCase();
    if (!name) continue;
    if (lowerRest.startsWith(name) && isBoundary(text[start + name.length])) {
      if (!best || name.length > best.length) best = { item, length: name.length };
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
    return { item: firstNameMatches[0], length: word.length };
  }
  return null;
}

/**
 * Parses a shoutout message for `@mentions`, `#categories`, and `+points`.
 *
 * Points rule: a `+N` applies to every mention since the previous `+N`
 * (or the start). So "@Dan @Prisca +10" gives each 10, while
 * "@Dan +20 @Prisca +10" gives Dan 20 and Prisca 10. A mention with no
 * following `+N` gets 0 points.
 */
export function parseShoutout(
  message: string,
  employees: ShoutoutLookupItem[],
  categories: ShoutoutLookupItem[],
): ParsedShoutout {
  const recipientsById = new Map<string, ParsedRecipient>();
  const pending: ParsedRecipient[] = [];
  const categoryIds: string[] = [];
  const categoryNames: string[] = [];
  const unknownMentions: string[] = [];
  const unknownCategories: string[] = [];

  let i = 0;
  while (i < message.length) {
    const char = message[i];

    if (char === '@') {
      const match = matchAt(message, i + 1, employees);
      if (match) {
        let recipient = recipientsById.get(match.item.id);
        if (!recipient) {
          recipient = { recipientId: match.item.id, name: match.item.name, points: 0 };
          recipientsById.set(match.item.id, recipient);
        }
        if (!pending.includes(recipient)) pending.push(recipient);
        i += 1 + match.length;
        continue;
      }
      const word = readWord(message, i + 1);
      if (word) unknownMentions.push(word);
      i += 1 + Math.max(word.length, 0);
      continue;
    }

    if (char === '#') {
      const match = matchAt(message, i + 1, categories);
      if (match) {
        if (!categoryIds.includes(match.item.id)) {
          categoryIds.push(match.item.id);
          categoryNames.push(match.item.name);
        }
        i += 1 + match.length;
        continue;
      }
      const word = readWord(message, i + 1);
      if (word) unknownCategories.push(word);
      i += 1 + Math.max(word.length, 0);
      continue;
    }

    if (char === '+' && /\d/.test(message[i + 1] ?? '')) {
      const digits = readDigits(message, i + 1);
      const amount = Number(digits);
      for (const recipient of pending) recipient.points = amount;
      pending.length = 0;
      i += 1 + digits.length;
      continue;
    }

    i += 1;
  }

  const recipients = [...recipientsById.values()];
  return {
    recipients,
    categoryIds,
    categoryNames,
    unknownMentions,
    unknownCategories,
    totalPoints: recipients.reduce((sum, r) => sum + r.points, 0),
  };
}

function readDigits(text: string, start: number): string {
  let end = start;
  while (end < text.length && /\d/.test(text[end])) end += 1;
  return text.slice(start, end);
}
