import { Check } from 'lucide-react';
import { PASSWORD_REQUIREMENTS } from '@/lib/password-policy';
import { cn } from '@/lib/utils';

export function PasswordRequirements({ password }: { password: string }) {
  return (
    <ul
      className="grid gap-1 pt-1 text-xs text-slate-500 sm:grid-cols-2"
      aria-label="Password requirements"
    >
      {PASSWORD_REQUIREMENTS.map((requirement) => {
        const met = requirement.matches(password);
        return (
          <li
            key={requirement.label}
            className={cn('flex items-center gap-1.5', met && 'text-emerald-700')}
          >
            <Check className={cn('size-3 shrink-0', met ? 'opacity-100' : 'opacity-30')} />
            {requirement.label}
          </li>
        );
      })}
    </ul>
  );
}
