/**
 * Maps ISO 3166-1 alpha-2 codes to Google public holiday calendar region ids.
 * @see https://dev.to/monfernape/get-country-holidays-using-google-calendar-api-3dh6
 */
const GOOGLE_HOLIDAY_REGION_OVERRIDES: Record<string, string> = {
  US: 'en.usa',
  GB: 'en.uk',
  UK: 'en.uk',
  CA: 'en.canadian',
  AU: 'en.australian',
  NZ: 'en.new_zealand',
  IN: 'en.indian',
  DE: 'en.german',
  FR: 'en.french',
  ES: 'en.spain',
  IT: 'en.italian',
  BR: 'en.brazilian',
  MX: 'en.mexican',
  JP: 'en.japanese',
  KR: 'en.south_korea',
  CN: 'en.china',
  ZA: 'en.sa',
  NG: 'en.ng',
  KE: 'en.ke',
  GH: 'en.gh',
  EG: 'en.egyptian',
  AE: 'en.ae',
  SA: 'en.saudiarabian',
  PH: 'en.philippines',
  SG: 'en.singapore',
  MY: 'en.malaysia',
  ID: 'en.indonesian',
  PK: 'en.pk',
  IE: 'en.irish',
  NL: 'en.dutch',
  BE: 'en.be',
  CH: 'en.ch',
  AT: 'en.austrian',
  SE: 'en.swedish',
  NO: 'en.norwegian',
  DK: 'en.danish',
  FI: 'en.finnish',
  PL: 'en.polish',
  PT: 'en.portuguese',
  GR: 'en.greek',
  TR: 'en.turkish',
  AR: 'en.ar',
  CL: 'en.cl',
  CO: 'en.co',
  PE: 'en.pe',
};

export function resolveGoogleHolidayRegion(countryCode: string): string {
  const upper = countryCode.trim().toUpperCase();
  return GOOGLE_HOLIDAY_REGION_OVERRIDES[upper] ?? `en.${upper.toLowerCase()}`;
}

export function buildGoogleHolidayCalendarId(countryCode: string): string {
  const region = resolveGoogleHolidayRegion(countryCode);
  return encodeURIComponent(`${region}#holiday@group.v.calendar.google.com`);
}
