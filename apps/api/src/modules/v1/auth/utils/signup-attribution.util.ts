import type { UserSignupAttribution } from '../../users/interfaces/user-metadata.interface';
import type { SignupAttributionDto } from '../dto/signup-attribution.dto';

const CONTROL_CHARS = /[\p{Cc}]/gu;
const SHORT_MAX = 160;
const URL_MAX = 300;

function clean(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function timestamp(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return Number.isNaN(Date.parse(value)) ? undefined : new Date(value).toISOString();
}

/**
 * Trims and bounds client-supplied attribution before it is persisted. Returns
 * undefined when the minimum shape (source + medium) is missing, so a partial
 * payload never pollutes user metadata.
 */
export function normalizeSignupAttribution(
  input?: SignupAttributionDto | null,
): UserSignupAttribution | undefined {
  if (!input) return undefined;

  const source = clean(input.source, SHORT_MAX);
  const medium = clean(input.medium, SHORT_MAX);
  if (!source || !medium) return undefined;

  const attribution: UserSignupAttribution = {
    source,
    medium,
    campaign: clean(input.campaign, SHORT_MAX),
    term: clean(input.term, SHORT_MAX),
    content: clean(input.content, SHORT_MAX),
    clickId: clean(input.clickId, URL_MAX),
    clickIdType: clean(input.clickIdType, SHORT_MAX),
    referrer: clean(input.referrer, URL_MAX),
    landingPage: clean(input.landingPage, URL_MAX),
    capturedAt: timestamp(input.capturedAt),
    firstSource: clean(input.firstSource, SHORT_MAX),
    firstMedium: clean(input.firstMedium, SHORT_MAX),
    firstCampaign: clean(input.firstCampaign, SHORT_MAX),
    firstLandingPage: clean(input.firstLandingPage, URL_MAX),
    firstCapturedAt: timestamp(input.firstCapturedAt),
  };

  return Object.fromEntries(
    Object.entries(attribution).filter(([, value]) => value !== undefined),
  ) as UserSignupAttribution;
}
