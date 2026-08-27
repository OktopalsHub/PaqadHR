import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn, getInitials } from '@/lib/utils';

export function BankLogo({ name, className }: { name: string; className?: string }) {
  return (
    <Avatar
      className={cn('size-6 shrink-0 rounded-md border border-slate-200/80 bg-white', className)}
    >
      <AvatarFallback className="rounded-md bg-white text-[10px] font-semibold text-slate-600">
        {getInitials(name) ?? '?'}
      </AvatarFallback>
    </Avatar>
  );
}
