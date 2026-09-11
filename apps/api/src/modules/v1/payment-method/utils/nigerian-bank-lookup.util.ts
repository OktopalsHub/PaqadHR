/**
 * Monnify uses a different code than NIP/Nomba for Paycom (Opay).
 * PalmPay is `100033` on both ([Monnify supported banks](https://developers.monnify.com/docs/supported-banks)).
 */
const NIP_TO_MONNIFY_BANK_CODE: Readonly<Record<string, string>> = {
  '100004': '999992', // Opay / Paycom
};

const MONNIFY_TO_NIP_BANK_CODE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(NIP_TO_MONNIFY_BANK_CODE).map(([nip, monnify]) => [monnify, nip]),
);

function uniqueCodes(codes: string[]): string[] {
  const out: string[] = [];
  for (const code of codes) {
    const trimmed = code.trim();
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

/** Codes to try against Monnify validate for a UI/Nomba bank code. */
export function monnifyBankCodesToTry(bankCode: string): string[] {
  const code = bankCode.trim();
  return uniqueCodes([NIP_TO_MONNIFY_BANK_CODE[code] ?? '', code]);
}

/** Codes to try against Nomba lookup for a UI/Monnify bank code. */
export function nombaBankCodesToTry(bankCode: string): string[] {
  const code = bankCode.trim();
  return uniqueCodes([MONNIFY_TO_NIP_BANK_CODE[code] ?? '', code]);
}

/** Always prefer Monnify for name enquiry when it is configured. */
export function shouldPreferMonnifyForBankLookup(input: { monnifyConfigured: boolean }): boolean {
  return input.monnifyConfigured;
}

export type BankListItem = {
  code: string;
  name: string;
  logoUrl?: string | null;
};

function normalizeBankName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .replace(/microfinancebank|mfb|bank|limited|ltd|plc/g, '');
}

/** Attach Nomba (or other) logos onto a primary bank list by code alias or name. */
export function mergeBankLogos(
  primary: BankListItem[],
  logoSources: BankListItem[],
): BankListItem[] {
  const byCode = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const source of logoSources) {
    const logo = source.logoUrl?.trim();
    if (!logo) continue;
    byCode.set(source.code.trim(), logo);
    const mapped = NIP_TO_MONNIFY_BANK_CODE[source.code.trim()];
    if (mapped) byCode.set(mapped, logo);
    const reverse = MONNIFY_TO_NIP_BANK_CODE[source.code.trim()];
    if (reverse) byCode.set(reverse, logo);
    byName.set(normalizeBankName(source.name), logo);
  }

  return primary.map((bank) => {
    if (bank.logoUrl?.trim()) return bank;
    const logo = byCode.get(bank.code.trim()) || byName.get(normalizeBankName(bank.name)) || null;
    return logo ? { ...bank, logoUrl: logo } : bank;
  });
}
