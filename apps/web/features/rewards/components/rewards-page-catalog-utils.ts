import type { CatalogItem } from '@/lib/api/rewards';

export function getGiftCardCategory(
  item: CatalogItem,
): 'Airtime' | 'Money Cards' | 'Gift Cards' | 'Gaming Cards' {
  const name = item.name.toLowerCase();

  if (
    name.includes('airtime') ||
    name.includes('mobile topup') ||
    name.includes('refill') ||
    name.includes('top-up') ||
    name.includes('telecom') ||
    name.includes('mtn') ||
    name.includes('airtel') ||
    name.includes('orange') ||
    name.includes('vodafone') ||
    name.includes('safaricom') ||
    name.includes('tigo')
  ) {
    return 'Airtime';
  }

  if (
    name.includes('visa') ||
    name.includes('mastercard') ||
    name.includes('american express') ||
    name.includes('amex') ||
    name.includes('prepaid card') ||
    name.includes('cash') ||
    name.includes('money')
  ) {
    return 'Money Cards';
  }

  if (
    name.includes('playstation') ||
    name.includes('xbox') ||
    name.includes('steam') ||
    name.includes('nintendo') ||
    name.includes('roblox') ||
    name.includes('pubg') ||
    name.includes('razer') ||
    name.includes('gaming') ||
    name.includes('riot') ||
    name.includes('league of legends') ||
    name.includes('minecraft') ||
    name.includes('nexon') ||
    name.includes('twitch')
  ) {
    return 'Gaming Cards';
  }

  return 'Gift Cards';
}

export function formatCost(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export const DEFAULT_CUSTOM_PERKS: CatalogItem[] = [
  {
    id: 'default_swag',
    name: 'Hoodie & Swag Kit',
    description:
      'Get a premium company branded hoodie, water bottle, and sticker pack shipped to you.',
    pointsCost: 3000,
    type: 'CUSTOM',
    currencyValue: 3000,
    currencyCode: 'NGN',
    imageUrl:
      'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500&auto=format&fit=crop&q=60',
    deliveryInstructions: 'Your HR team will reach out to request your size and shipping address.',
  },
  {
    id: 'default_day_off',
    name: 'Extra Day of Paid Time Off (PTO)',
    description: 'Enjoy an additional day of paid leave. Must be scheduled with your manager.',
    pointsCost: 5000,
    type: 'CUSTOM',
    currencyValue: 5000,
    currencyCode: 'NGN',
    imageUrl:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=60',
    deliveryInstructions: 'Leave credit will be applied directly to your profile upon approval.',
  },
  {
    id: 'default_coffee',
    name: 'Starbucks Coffee & Muffin Voucher',
    description: 'Start your morning right with a warm beverage and snack on us.',
    pointsCost: 500,
    type: 'CUSTOM',
    currencyValue: 500,
    currencyCode: 'NGN',
    imageUrl:
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&auto=format&fit=crop&q=60',
    deliveryInstructions: 'A digital voucher code will be sent to your registered work email.',
  },
  {
    id: 'default_gym',
    name: '1-Month Gym Membership Subsidy',
    description: 'Stay healthy and active! Get your local gym membership funded for a month.',
    pointsCost: 4000,
    type: 'CUSTOM',
    currencyValue: 4000,
    currencyCode: 'NGN',
    imageUrl:
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500&auto=format&fit=crop&q=60',
    deliveryInstructions:
      'Submit your gym receipt to HR to receive a full cash-back reimbursement.',
  },
];

export function getAvailableCustomPerkTemplates(customPerks: CatalogItem[]): CatalogItem[] {
  const activeNames = new Set(customPerks.map((perk) => perk.name.trim().toLowerCase()));
  return DEFAULT_CUSTOM_PERKS.filter(
    (template) => !activeNames.has(template.name.trim().toLowerCase()),
  );
}

export function dataPlanId(plan: { amount: number; plan: string; productCode?: string }) {
  return plan.productCode ? plan.productCode : `${plan.amount}:${plan.plan}`;
}
