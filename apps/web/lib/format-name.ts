function capitalizeWord(word: string): string {
  if (!word) return word;
  if (word.includes('-')) {
    return word.split('-').map(capitalizeWord).join('-');
  }
  if (word.includes("'")) {
    return word
      .split("'")
      .map((part, index) => (index === 0 ? capitalizeWord(part) : part.toLowerCase()))
      .join("'");
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function toTitleCase(value: string): string {
  return value.trim().split(/\s+/).filter(Boolean).map(capitalizeWord).join(' ');
}

export function formatDisplayName(name?: string | null, fallback = 'Member'): string {
  const trimmed = name?.trim();
  if (!trimmed) return fallback;
  return toTitleCase(trimmed);
}

export function formatPersonName(
  firstName?: string | null,
  lastName?: string | null,
  fallback = 'Member',
): string {
  const parts = [firstName, lastName]
    .map((part) => (part?.trim() ? toTitleCase(part.trim()) : ''))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : fallback;
}

export function formatWorkspaceName(name?: string | null, fallback = 'Paqad'): string {
  const trimmed = name?.trim();
  if (!trimmed) return fallback;
  return toTitleCase(trimmed);
}
