export function renderCelebrationTemplate(
  template: string,
  variables: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = variables[key];
    return value == null ? '' : String(value);
  });
}

export function memberDisplayName(member: {
  preferredName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  if (member.preferredName?.trim()) return member.preferredName.trim();
  return [member.firstName, member.lastName].filter(Boolean).join(' ').trim() || 'Team member';
}
