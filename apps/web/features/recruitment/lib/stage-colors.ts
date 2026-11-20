export const STAGE_COLOR_PALETTE = [
  { name: 'Slate', value: '#64748b' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Violet', value: '#8b5cf6' },
] as const;

const TYPE_COLORS: Record<string, string> = {
  APPLIED: '#64748b',
  SCREENING: '#3b82f6',
  UNDER_REVIEW: '#3b82f6',
  INTERVIEW: '#8b5cf6',
  OFFER: '#f59e0b',
  HIRED: '#22c55e',
  REJECTED: '#ef4444',
  WITHDRAWN: '#ef4444',
};

const FALLBACK_COLOR = '#64748b';

export function stageColor(stage: { color?: string | null; type: string }): string {
  return stage.color ?? TYPE_COLORS[stage.type] ?? FALLBACK_COLOR;
}

export function statusColor(status: string): string {
  return TYPE_COLORS[status] ?? FALLBACK_COLOR;
}
