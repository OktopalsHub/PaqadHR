import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, getInitials } from '@/lib/utils';

export function BankLogo({
  name,
  logoUrl,
  className,
}: {
  name: string;
  logoUrl?: string | null;
  className?: string;
}) {
  return (
    <Avatar
      className={cn('size-6 shrink-0 rounded-md border border-slate-200/80 bg-white', className)}
    >
      {logoUrl ? <AvatarImage src={logoUrl} alt={name} className="object-contain p-0.5" /> : null}
      <AvatarFallback className="rounded-md bg-white text-[10px] font-semibold text-slate-600">
        {getInitials(name) ?? '?'}
      </AvatarFallback>
    </Avatar>
  );
}
