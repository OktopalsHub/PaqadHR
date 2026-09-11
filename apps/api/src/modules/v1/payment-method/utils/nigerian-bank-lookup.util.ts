/**
 * Monnify uses different codes than NIP/Nomba for some wallets.
 * Prefer Monnify codes when calling Monnify validate.
 */
const NIP_TO_MONNIFY_BANK_CODE: Readonly<Record<string, string>> = {
  '100004': '999992', // Opay / Paycom
  '100033': '999991', // PalmPay
};

/** Codes to try against Monnify for a UI/Nomba bank code. */
export function monnifyBankCodesToTry(bankCode: string): string[] {
  const code = bankCode.trim();
  const codes: string[] = [];
  const push = (value: string) => {
    if (value && !codes.includes(value)) codes.push(value);
  };

  const mapped = NIP_TO_MONNIFY_BANK_CODE[code];
  if (mapped) push(mapped);
  push(code);

  for (const [nipCode, monnifyCode] of Object.entries(NIP_TO_MONNIFY_BANK_CODE)) {
    if (monnifyCode === code) push(nipCode);
  }

  return codes;
}

/**
 * Nomba sandbox bank lookup returns stub account names (not real NIBSS).
 * Prefer Monnify whenever Nomba is not live and Monnify is configured.
 */
export function shouldPreferMonnifyForBankLookup(input: {
  monnifyConfigured: boolean;
  nombaLive: boolean;
}): boolean {
  return input.monnifyConfigured && !input.nombaLive;
}
