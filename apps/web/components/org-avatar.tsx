import { Building2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, getInitials } from '@/lib/utils';

export type OrgAvatarProps = {
  src?: string | null;
  name: string;
  className?: string;
  fallbackClassName?: string;
  /** Show building icon instead of initials when there is no image. */
  iconFallback?: boolean;
};

export function OrgAvatar({
  src,
  name,
  className,
  fallbackClassName,
  iconFallback = false,
}: OrgAvatarProps) {
  return (
    <Avatar className={cn('size-8 shrink-0 rounded-lg', className)}>
      {src ? <AvatarImage src={src} alt={name} className="object-contain" /> : null}
      <AvatarFallback
        className={cn(
          'rounded-lg bg-primary/10 text-xs font-semibold text-primary',
          fallbackClassName,
        )}
      >
        {iconFallback ? <Building2 className="size-4" aria-hidden /> : getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
