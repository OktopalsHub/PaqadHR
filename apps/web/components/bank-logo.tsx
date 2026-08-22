import { cn } from '@/lib/utils';

const BANK_BRANDS: Record<string, { background: string; initials: string }> = {
  'access bank': { background: 'bg-[#e32b24]', initials: 'A' },
  'access bank (diamond)': { background: 'bg-[#e32b24]', initials: 'A' },
  'ecobank nigeria': { background: 'bg-[#0059a7]', initials: 'E' },
  'fidelity bank': { background: 'bg-[#008f5d]', initials: 'F' },
  'first bank of nigeria': { background: 'bg-[#0a3b8f]', initials: '1' },
  'first city monument bank': { background: 'bg-[#7d1d4d]', initials: 'F' },
  'guaranty trust bank': { background: 'bg-[#f58220]', initials: 'G' },
  'heritage bank': { background: 'bg-[#8e1d5b]', initials: 'H' },
  'jaiz bank': { background: 'bg-[#0d8554]', initials: 'J' },
  'keystone bank': { background: 'bg-[#1f71ba]', initials: 'K' },
  'kuda bank': { background: 'bg-[#40196d]', initials: 'K' },
  'moniepoint mfb': { background: 'bg-[#063b5c]', initials: 'M' },
  opay: { background: 'bg-[#00a859]', initials: 'O' },
  palmpay: { background: 'bg-[#7254f5]', initials: 'P' },
  'parallex bank': { background: 'bg-[#8a1538]', initials: 'P' },
  'polaris bank': { background: 'bg-[#003f87]', initials: 'P' },
  'providus bank': { background: 'bg-[#f26522]', initials: 'P' },
  'stanbic ibtc bank': { background: 'bg-[#0033a0]', initials: 'S' },
  'standard chartered bank': { background: 'bg-[#007f6f]', initials: 'S' },
  'sterling bank': { background: 'bg-[#ec2027]', initials: 'S' },
  'suntrust bank': { background: 'bg-[#f58220]', initials: 'S' },
  'union bank of nigeria': { background: 'bg-[#003d7c]', initials: 'U' },
  'united bank for africa': { background: 'bg-[#e31b23]', initials: 'U' },
  'unity bank': { background: 'bg-[#dd1f26]', initials: 'U' },
  'vfd microfinance bank': { background: 'bg-[#142c50]', initials: 'V' },
  'wema bank': { background: 'bg-[#773a97]', initials: 'W' },
  'zenith bank': { background: 'bg-[#e31b23]', initials: 'Z' },
};

function fallbackInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.length > 1
    ? `${words[0][0]}${words[1][0]}`.toUpperCase()
    : (words[0]?.slice(0, 2).toUpperCase() ?? 'B');
}

export function BankLogo({ name, className }: { name: string; className?: string }) {
  const brand = BANK_BRANDS[name.trim().toLowerCase()];

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold tracking-[-0.08em] text-white shadow-sm',
        brand?.background ?? 'bg-slate-600',
        className,
      )}
    >
      {brand?.initials ?? fallbackInitials(name)}
    </span>
  );
}
