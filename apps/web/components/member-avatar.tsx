import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type MemberLike = {
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
  avatarUrl?: string | null;
};

function memberLabel(member: MemberLike) {
  return (
    [member.firstName, member.lastName].filter(Boolean).join(" ") ||
    member.preferredName ||
    "Team member"
  );
}

function memberInitials(member: MemberLike) {
  const first = member.firstName?.trim();
  const last = member.lastName?.trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  if (member.preferredName?.trim()) {
    return member.preferredName.trim().slice(0, 2).toUpperCase();
  }
  return "TM";
}

type MemberAvatarProps = {
  member: MemberLike;
  className?: string;
  fallbackClassName?: string;
};

export function MemberAvatar({
  member,
  className,
  fallbackClassName,
}: MemberAvatarProps) {
  const label = memberLabel(member);

  return (
    <Avatar className={cn("size-9 shrink-0", className)}>
      <AvatarImage src={member.avatarUrl ?? undefined} alt={label} />
      <AvatarFallback
        className={cn(
          "bg-primary/10 text-xs font-medium text-primary",
          fallbackClassName,
        )}
      >
        {memberInitials(member)}
      </AvatarFallback>
    </Avatar>
  );
}

export { memberLabel, memberInitials };
