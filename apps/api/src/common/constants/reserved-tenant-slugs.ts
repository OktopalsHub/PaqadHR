import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Runtime load — static JSON import outside src/ expands TS rootDir and nests dist/.
const reservedTenantSlugList = JSON.parse(
  readFileSync(join(__dirname, '../../../../../constants/reserved-tenant-slugs.json'), 'utf8'),
) as string[];

const ENV_EXTRA_KEYS = ['TENANT_EXCLUDED_SUBDOMAINS', 'EXCLUDED_SUBDOMAINS'] as const;

function readEnvExtras(): string[] {
  const values = ENV_EXTRA_KEYS.flatMap((key) => {
    const raw = process.env[key];
    if (!raw?.trim()) return [];
    return raw
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  });
  return [...new Set(values)];
}

export const RESERVED_TENANT_SLUG_LIST = [...reservedTenantSlugList] as readonly string[];

export const RESERVED_TENANT_SLUGS = new Set<string>([
  ...RESERVED_TENANT_SLUG_LIST.map((slug) => slug.toLowerCase()),
  ...readEnvExtras(),
]);

export function isReservedTenantSlug(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return true;
  return RESERVED_TENANT_SLUGS.has(normalized);
}
