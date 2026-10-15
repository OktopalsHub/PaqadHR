export function getTremendousBaseUrl(): string {
  if (isTremendousSandbox()) {
    return 'https://testflight.tremendous.com/api/v2';
  }
  return (process.env.TREMENDOUS_BASE_URL || 'https://api.tremendous.com/api/v2').replace(
    /\/$/,
    '',
  );
}

export function getTremendousApiKey(): string {
  return (process.env.TREMENDOUS_API_KEY || '').trim();
}

export function getTremendousFundingSourceId(): string {
  return (process.env.TREMENDOUS_FUNDING_SOURCE_ID || '').trim();
}

export function isTremendousSandbox(): boolean {
  return process.env.TREMENDOUS_SANDBOX === 'true';
}

export function isTremendousConfigured(): boolean {
  return !!(getTremendousApiKey() && getTremendousFundingSourceId());
}
