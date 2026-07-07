/** Tenant-scoped display fields — never fall back to User (auth) identity. */
type MemberNameFields = {
  preferredName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
};

export function formatMemberDisplayName(
  member: MemberNameFields | null | undefined,
): string | null {
  if (!member) return null;
  const first = member.firstName?.trim() ?? '';
  const middle = member.middleName?.trim() ?? '';
  const last = member.lastName?.trim() ?? '';
  const full = [first, middle, last].filter(Boolean).join(' ').trim();
  if (full) return full;
  const preferred = member.preferredName?.trim();
  if (preferred) return preferred;
  return null;
}

type InviteeNameFields = {
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
};

/** Invitation invitee label from tenant invitation record (not User). */
export function formatInviteeDisplayName(invitation: InviteeNameFields): string {
  return formatMemberDisplayName(invitation) ?? 'A team member';
}
