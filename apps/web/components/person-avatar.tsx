import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, getInitials } from '@/lib/utils';

export type PersonAvatarProps = {
  src?: string | null;
  name: string;
  className?: string;
  fallbackClassName?: string;
};

export function PersonAvatar({ src, name, className, fallbackClassName }: PersonAvatarProps) {
  return (
    <Avatar className={cn('size-8 shrink-0', className)}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback className={fallbackClassName}>{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
