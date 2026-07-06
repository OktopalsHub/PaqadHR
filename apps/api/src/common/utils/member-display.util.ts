type MemberNameFields = {
  preferredName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  user?: { email?: string | null } | null;
};

export function formatMemberDisplayName(
  member: MemberNameFields | null | undefined,
): string | null {
  if (!member) return null;
  const preferred = member.preferredName?.trim();
  if (preferred) return preferred;
  const first = member.firstName?.trim() ?? '';
  const last = member.lastName?.trim() ?? '';
  const full = `${first} ${last}`.trim();
  if (full) return full;
  return member.user?.email?.trim() ?? null;
}

type InviteeNameFields = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

export function formatInviteeDisplayName(invitation: InviteeNameFields): string {
  const first = invitation.firstName?.trim() ?? '';
  const last = invitation.lastName?.trim() ?? '';
  const full = `${first} ${last}`.trim();
  if (full) return full;
  return 'A team member';
}
